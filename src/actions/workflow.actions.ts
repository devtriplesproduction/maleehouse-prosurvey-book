"use server";

import { normalizeData } from '@/lib/normalize';

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserProfileAction } from "@/actions/auth.actions";
import { revalidateAccountsPaths } from "@/actions/revalidate-utils";

import {
  Role,
  verifyProjectAccess,
  canUpdateProjectStage,
  canUploadFileCategory
} from "@/lib/permissions/permissions";
import { requireProjectAccess } from "@/lib/permissions/project-access";
import { notifySupplementalUploadAction, notifyStageUpdateAction, notifyAdminDispatchOverrideRequestAction } from "@/actions/notification.actions";
import { getTasksForStage } from "@/lib/workflow-engine";
import { createAuditLog } from '@/lib/audit/createAuditLog';
import { logWorkflowAudit } from "@/lib/workflow/logWorkflowAudit";

export type WorkflowResponse = {
  success: boolean;
  error: string | null;
  data?: any;
};

export async function requestDispatchOverrideAction(projectId: string): Promise<WorkflowResponse> {
  try {
    const auth = await requireProjectAccess(projectId, { requireUnlocked: true });
    if (!auth.authorized) return { success: false, error: auth.error || 'Unauthorized' };

    if (auth.role !== 'admin' && auth.role !== 'accountant') {
      return { success: false, error: 'Access denied. Only Admins or Accountants can request overrides.' };
    }

    const adminSupabase = await createAdminClient();
    
    // Update the project to store the requested state
    const { data: updatedProject, error } = await adminSupabase
      .from('projects')
      .update({ dispatch_override_requested: true } as never)
      .eq('id', projectId)
      .select()
      .maybeSingle();

    if (error) {
      console.error("Error setting override state:", error);
      return { success: false, error: `Failed to save override request status. Please try again later.` };
    }

    if (!updatedProject) {
      return { success: false, error: `Project not found or update failed.` };
    }

    // Optional: Could store this in metadata or a custom column. For now, we just rely on sending the notification.
    await notifyAdminDispatchOverrideRequestAction(projectId);
    
    revalidatePath(`/projects/${projectId}`);
    return { success: true, error: null, data: updatedProject };
  } catch (err) {
    console.error("requestDispatchOverrideAction error:", err);
    return { success: false, error: "Failed to request override due to an unexpected error." };
  }
}

export async function getAllOverrideRequestsAction() {
  try {
    const supabase: any = await createClient();
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('id, title, message, is_read, created_at, related_project_id, projects!notifications_related_project_id_fkey(name, client_name, status)')
      .eq('title', 'Dispatch Override Requested')
      .order('created_at', { ascending: false });

    let finalData = [];

    if (error) {
      // Fallback if projects relation fails
      const { data: fallbackData } = await supabase
        .from('notifications')
        .select('*')
        .eq('title', 'Dispatch Override Requested')
        .order('created_at', { ascending: false });
        
      if (!fallbackData) return { success: false, error: error.message };
      finalData = fallbackData.map((n: any) => ({ ...n, projects: null }));
    } else {
      finalData = notifications || [];
    }
    
    // De-duplicate by project_id just in case multiple admins get the notification
    const uniqueMap = new Map();
    for (const n of finalData) {
      if (n.related_project_id && !uniqueMap.has(n.related_project_id)) {
        uniqueMap.set(n.related_project_id, n);
      }
    }

    // Recover all projects with active or approved dispatch overrides to construct history
    const { data: overrideProjects } = await supabase
      .from('projects')
      .select('id, name, client_name, status, updated_at, dispatch_override_requested, dispatch_override_approved')
      .or('dispatch_override_requested.eq.true,dispatch_override_approved.eq.true');
      
    if (overrideProjects && overrideProjects.length > 0) {
      for (const p of overrideProjects) {
        if (!uniqueMap.has(p.id)) {
          uniqueMap.set(p.id, {
            id: `proj-${p.id}`,
            title: p.dispatch_override_approved ? 'Dispatch Override Approved' : 'Dispatch Override Requested',
            message: p.dispatch_override_approved 
              ? `Override approved for Project "${p.name}".`
              : `Accountant requested dispatch override for Project "${p.name}" (Payment is pending).`,
            is_read: p.dispatch_override_approved,
            created_at: p.updated_at || new Date().toISOString(),
            related_project_id: p.id,
            projects: {
              name: p.name,
              client_name: p.client_name,
              status: p.status
            }
          });
        } else {
          // Sync state if already exists in notification map
          uniqueMap.get(p.id).is_read = p.dispatch_override_approved;
        }
      }
    }

    const sortedData = Array.from(uniqueMap.values()).sort((a: any, b: any) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return { success: true, data: normalizeData(sortedData) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function approveDispatchOverrideAction(projectId: string) {
  try {
    const supabase: any = await createClient();
    
    // 1. Mark ALL related override notifications as read for this project
    await supabase.from('notifications')
      .update({ is_read: true })
      .eq('related_project_id', projectId)
      .eq('title', 'Dispatch Override Requested');
      
    // 2. Reset the override requested state and set approved state
    const { data: updatedProject, error } = await supabase.from('projects')
      .update({ 
        dispatch_override_requested: false,
        dispatch_override_approved: true
      })
      .eq('id', projectId)
      .select('status, id')
      .single();
      
    if (error) throw error;
      
    // Only auto-advance if the project is stuck in a pre-dispatch stage
    const preDispatchStages = ['lead_created', 'payment_pending', 'payment_done', 'ready_for_dispatch'];
    if (updatedProject && preDispatchStages.includes(updatedProject.status)) {
      await transitionWorkflowAction(projectId, "project_created", "Admin approved dispatch override without payment");
    }

    revalidatePath('/admin');
    await revalidateAccountsPaths(projectId);
    return { success: true, data: updatedProject };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function rejectDispatchOverrideAction(projectId: string) {
  try {
    const supabase: any = await createClient();
    // 1. Mark ALL related override notifications as read for this project
    await supabase.from('notifications')
      .update({ is_read: true })
      .eq('related_project_id', projectId)
      .eq('title', 'Dispatch Override Requested');
      
    // 2. Reset the override requested state
    const { data: updatedProject, error } = await supabase.from('projects')
      .update({ dispatch_override_requested: false })
      .eq('id', projectId)
      .select()
      .single();
      
    if (error) throw error;
      
    revalidatePath('/admin');
    await revalidateAccountsPaths(projectId);
    return { success: true, data: updatedProject };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * verifyProjectNotLocked
 * Checks if project status is completed or archived, returning failure if so.
 */
async function verifyProjectNotLocked(projectId: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase: any = await createClient();
    const { data: project } = await supabase
      .from("projects")
      .select("status")
      .eq("id", projectId)
      .single();

    if (project?.status === "completed" || project?.status === "archived") {
      return { success: false, error: "Project is locked (completed/archived) and cannot be modified." };
    }
  } catch (err: any) {
    console.error("verifyProjectNotLocked error:", err);
    return { success: false, error: err.message || "Database validation failed." };
  }
  return { success: true, error: null };
}

/**
 * validateStageTransition
 * Enforces strict prerequisite checking for each transition in the project lifecycle.
 * Pass `projectSnapshot` from the caller to avoid re-fetching projects.
 */
async function validateStageTransition(
  projectId: string,
  newStage: string,
  projectSnapshot?: { status?: string; dispatch_override_approved?: boolean } | null
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase: any = await createClient();

    // Reuse caller's project row when available (saves 1–2 queries per transition)
    let projectOverride = projectSnapshot;
    if (!projectOverride) {
      const { data } = await supabase
        .from('projects')
        .select('status, dispatch_override_approved')
        .eq('id', projectId)
        .single();
      projectOverride = data;
    }

    if (projectOverride?.dispatch_override_approved) {
      return { success: true, error: null };
    }

    // Dynamic Milestone Gate Check — only columns needed
    const { data: linkedMilestone } = await supabase
      .from('project_milestones')
      .select('id, title, status')
      .eq('project_id', projectId)
      .eq('linked_stage', newStage)
      .maybeSingle();

    if (linkedMilestone && linkedMilestone.status !== 'paid') {
      return {
        success: false,
        error: `Cannot transition to "${newStage}": The payment for milestone "${linkedMilestone.title}" must be paid and verified first.`
      };
    }

    switch (newStage) {
      case "payment_pending": {
        const { data: milestones } = await supabase.from("project_milestones").select("id").eq("project_id", projectId).limit(1);
        const { data: proj } = await supabase.from("projects").select("budget").eq("id", projectId).maybeSingle();
        if ((!milestones || milestones.length === 0) && (!proj || !proj.budget || proj.budget <= 0)) {
          return {
            success: false,
            error: "Cannot transition to Payment Pending: Project amount and milestones are required."
          };
        }
        break;
      }
      case "payment_done": {
        // Parallel payment/invoice check
        const [paymentRes, invoiceRes] = await Promise.all([
          supabase.from("payments").select("status").eq("project_id", projectId).eq("status", "verified").limit(1).maybeSingle(),
          supabase.from("invoices").select("id").eq("project_id", projectId).eq("status", "paid").limit(1).maybeSingle(),
        ]);
        if (!paymentRes.data && !invoiceRes.data) {
          return {
            success: false,
            error: "Cannot transition to Payment Done: Payment verification is pending or rejected."
          };
        }
        break;
      }
      case "ready_for_dispatch": {
        const { data: milestones } = await supabase.from("project_milestones").select("id").eq("project_id", projectId).limit(1);
        const { data: proj } = await supabase.from("projects").select("budget").eq("id", projectId).maybeSingle();
        if ((!milestones || milestones.length === 0) && (!proj || !proj.budget || proj.budget <= 0)) {
          return {
            success: false,
            error: "Cannot transition to Ready For Dispatch: Project amount and milestones are required."
          };
        }
        break;
      }
      case "project_created": {
        if (projectOverride?.status !== "ready_for_dispatch") {
          return {
            success: false,
            error: "Cannot transition to Engineering: The project must be Ready For Dispatch before it can be sent to Engineering."
          };
        }
        break;
      }
      case "data_collection": {
        const { data: assignment } = await supabase.from("project_assignments").select("id").eq("project_id", projectId).limit(1);
        if (!assignment || assignment.length === 0) {
          return {
            success: false,
            error: "Cannot transition to Data Collection: No technical team is assigned to this project."
          };
        }
        break;
      }

      case "field_assigned": {
        const { data: assignment } = await supabase
          .from("project_assignments")
          .select("id")
          .eq("project_id", projectId)
          .in("role", ["field", "lidar_specialist"])
          .limit(1);
        if (!assignment || assignment.length === 0) {
          return {
            success: false,
            error: "Cannot transition to Field Assigned: A Field Crew member must be assigned to this project first."
          };
        }
        break;
      }
      case "field_work": {
        const { data: assignment } = await supabase
          .from("project_assignments")
          .select("id")
          .eq("project_id", projectId)
          .in("role", ["field", "lidar_specialist"])
          .limit(1);
        if (!assignment || assignment.length === 0) {
          return {
            success: false,
            error: "Cannot transition to Field Work: A Field Crew member must be assigned to this project first."
          };
        }
        break;
      }
      case "data_sync": {
        const { data: files } = await supabase.from("files").select("id").eq("project_id", projectId).eq("category", "survey_data").limit(1);
        if (!files || files.length === 0) {
          return {
            success: false,
            error: "Cannot transition to Data Sync: Field survey raw coordinate files must be submitted."
          };
        }
        break;
      }

      case "final_review": {
        // Gate: All assigned materials and equipment must be submitted to the company before advancing past survey validation
        const { data: pendingMaterials } = await supabase
          .from("material_requests")
          .select("id, item_name, quantity")
          .eq("project_id", projectId)
          .in("status", ["assigned", "requested"]);

        if (pendingMaterials && pendingMaterials.length > 0) {
          const names = pendingMaterials.map((m: any) => `${m.quantity}x ${m.item_name}`).join(", ");
          return {
            success: false,
            error: `Cannot validate survey: All assigned materials and equipment must be submitted to the company or reported missing/lost with responsible member (${names}).`
          };
        }
        break;
      }

      case "completed": {
        // Gate 1: Final deliverable file required
        const { data: files } = await supabase.from("files").select("id").eq("project_id", projectId).eq("category", "final_file").limit(1);
        if (!files || files.length === 0) {
          return {
            success: false,
            error: "Cannot complete project: A final deliverable file must be uploaded before completion."
          };
        }

        // Gate 3: Field Engineer must be assigned
        const { data: fieldAssignment } = await supabase
          .from("project_assignments")
          .select("id")
          .eq("project_id", projectId)
          .eq("role", "field")
          .limit(1);
        if (!fieldAssignment || fieldAssignment.length === 0) {
          return {
            success: false,
            error: "Cannot complete project: A Field Engineer must be assigned before completion."
          };
        }

        // Gate 4: Workflow must have gone through at least final_review or data_sync
        const { data: historyCheck } = await supabase
          .from("workflow_history")
          .select("id")
          .eq("project_id", projectId)
          .in("to_stage", ["data_sync", "final_review"])
          .limit(1);
        const { data: projectInfo } = await supabase.from("projects").select("status").eq("id", projectId).single();
        if (!["data_sync", "final_review"].includes(projectInfo?.status || "") && (!historyCheck || historyCheck.length === 0)) {
          return {
            success: false,
            error: "Cannot complete project: Project must pass through Survey Validation / Final Review first."
          };
        }
        break;
      }
    }
  } catch (error: any) {
    console.error("validateStageTransition error:", error);
    return { success: false, error: error.message || "Database validation failed." };
  }
  return { success: true, error: null };
}

/**
 * transitionWorkflowAction
 * Centralized workflow transition engine that updates the project status, logs history,
 * logs activity, and sends automated notifications to all assigned team members.
 */
export async function transitionWorkflowAction(
  projectId: string,
  newStage: string,
  comment?: string,
  options?: { isAutomatedRewind?: boolean }
): Promise<WorkflowResponse> {
  try {
    const auth = await requireProjectAccess(projectId, { requireUnlocked: false });
    if (!auth.authorized) return { success: false, error: auth.error || "Access denied." };

    newStage = (newStage === 'delivered' || newStage === 'deliver') ? 'completed' : newStage;
    const role = auth.role as Role;
    const supabase: any = await createClient();

    // Fetch current status to determine from_stage
    const { data: project } = await supabase.from("projects").select("status, is_frozen, dispatch_override_approved, workflow_type").eq("id", projectId).single();
    const fromStage = project?.status || null;

    if (fromStage === newStage) {
      return { success: true, data: project, error: null };
    }

    if (project?.is_frozen) {
      return { success: false, error: "PROJECT FROZEN: All operational work, task completions, and stage transitions are disabled due to outstanding payments." };
    }

    // Operational Stage Gate Validation
    let isRollback = false;
    let isDirectAdvance = false;

    if (project?.workflow_type) {
      const { getTemplateConfig } = await import("@/lib/workflow-engine");
      const template = getTemplateConfig(project.workflow_type);
      const pipeline = template?.pipeline || [];
      const currentIndex = pipeline.indexOf(fromStage || "project_created");
      const targetIndex = pipeline.indexOf(newStage);

      if (targetIndex !== -1 && currentIndex !== -1) {
        isRollback = targetIndex < currentIndex;
        isDirectAdvance = targetIndex > currentIndex;
      }
    }

    if (!isRollback && !isDirectAdvance) {
      const STAGE_ORDER = [
        "lead",
        "lead_created",
        "quotation_requested",
        "quotation_sent",
        "payment_pending",
        "payment_done",
        "ready_for_dispatch",
        "project_created",
        "data_collection",
        "prototype",
        "gis_design",
        "field_assigned",
        "field_work",
        "data_sync",
        "review",
        "final_review",
        "completed",
        "delivered",
        "archived"
      ];
      const currentStageIndex = STAGE_ORDER.indexOf(fromStage || "lead");
      const newStageIndex = STAGE_ORDER.indexOf(newStage);
      isRollback = newStageIndex < currentStageIndex;
    }

    // Only enforce forward stage update role permissions if not a rollback/rewind
    if (!isRollback && !options?.isAutomatedRewind) {
      const stageCheck = canUpdateProjectStage(role, newStage);
      if (!stageCheck.isAllowed) {
        return { success: false, error: stageCheck.error || "Access denied." };
      }
    }

    // Only lock completed if not a rollback/rewind triggered by new data or rework
    if ((fromStage === "completed" || fromStage === "delivered" || fromStage === "archived") && !isRollback) {
      return { success: false, error: "Project is locked (completed/archived) and cannot be modified." };
    }

    if (role !== "admin" && !isRollback) {
      const gateCheck = await validateStageTransition(projectId, newStage, project);
      if (!gateCheck.success) {
        return { success: false, error: gateCheck.error || "Stage transition gate check failed." };
      }
    }

    const clearOverride = !!(project?.dispatch_override_approved && role !== "admin");
    let taskTitles: string[] = [];
    try {
      taskTitles = getTasksForStage(newStage) || [];
    } catch {
      taskTitles = [];
    }

    // Prefer single DB RPC (update + history + activity + tasks) — fewer round-trips
    let updatedProject: any = null;
    let fromStageFinal = fromStage;

    const { data: rpcResult, error: rpcError } = await supabase.rpc("transition_project_stage", {
      p_project_id: projectId,
      p_to_stage: newStage,
      p_user_id: auth.userId,
      p_role: role,
      p_comment: comment || `Status updated by ${role}`,
      p_clear_override: clearOverride,
      p_task_titles: taskTitles.length > 0 ? taskTitles : null,
    });

    if (!rpcError && rpcResult?.ok) {
      updatedProject = rpcResult.project;
      fromStageFinal = rpcResult.from_stage || fromStage;
    } else {
      // Fallback path if RPC not migrated yet or if rolling back from completed/archived project
      if (rpcError) {
        console.warn("transition_project_stage RPC unavailable, using multi-query fallback:", rpcError.message);
      } else if (rpcResult && !rpcResult.ok) {
        if (fromStage === "completed" || fromStage === "archived" || fromStage === "delivered" || rpcResult.error?.includes("locked") || isRollback) {
          console.warn("Project was completed/locked or RPC rejected rollback, proceeding with adminClient fallback to update stage:", rpcResult.error);
        } else {
          return { success: false, error: rpcResult.error || "Stage transition failed." };
        }
      }

      const adminClient: any = createAdminClient();
      const { error: updateError, data: proj } = await adminClient
        .from("projects")
        .update({
          status: newStage,
          updated_at: new Date().toISOString(),
          ...(clearOverride ? { dispatch_override_approved: false } : {}),
        })
        .eq("id", projectId)
        .select()
        .single();

      if (updateError || !proj) {
        return {
          success: false,
          error: `Project not found or update failed. DB Error: ${updateError?.message || "None"}`,
        };
      }
      updatedProject = proj;

      await Promise.all([
        adminClient.from("workflow_history").insert({
          id: `wh-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          project_id: projectId,
          from_stage: fromStage,
          to_stage: newStage,
          changed_by: auth.userId,
          comment: comment || `Status updated by ${role}`,
          created_at: new Date().toISOString(),
        }),
        adminClient.from("activity_logs").insert({
          project_id: projectId,
          user_id: auth.userId,
          action: "STAGE_UPDATE",
          details: { from_status: fromStage, new_status: newStage, role },
          created_at: new Date().toISOString(),
        }),
      ]);

      if (taskTitles.length > 0) {
        const defaultDueDate = new Date();
        defaultDueDate.setDate(defaultDueDate.getDate() + 2);
        await supabase.from("tasks").insert(
          taskTitles.map((title: string) => ({
            project_id: projectId,
            stage: newStage,
            title: title.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
            status: "pending",
            due_date: defaultDueDate.toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }))
        ).catch((e: any) => console.error("Auto-task generation failed:", e));
      }
    }

    // Notifications stay in app (recipient rules) — fire-and-forget
    await notifyStageUpdateAction(projectId, fromStageFinal || "lead", newStage).catch(console.error);

    await createAuditLog({
      action: 'PROJECT_UPDATED',
      module: 'Projects',
      entityType: 'Project',
      entityId: projectId,
      description: `Project stage changed to ${newStage}`,
      oldValue: { status: fromStageFinal },
      newValue: { status: newStage },
    });

    await revalidateAccountsPaths(projectId);

    return { success: true, error: null, data: updatedProject };
  } catch (err: any) {
    console.error("transitionWorkflowAction error:", err);
    return { success: false, error: err.message || "Failed to transition workflow stage" };
  }
}

/**
 * updateProjectStageAction
 * Main wrapper for stage transitions. Delegates entirely to transitionWorkflowAction.
 */
export async function updateProjectStageAction(
  projectId: string,
  newStatus: string,
  comment?: string
): Promise<WorkflowResponse> {
  return transitionWorkflowAction(projectId, newStatus, comment);
}

/**
 * getProjectActivityAction
 * Fetches workflow history and comments for a specific project
 */
export async function getProjectActivityAction(projectId: string) {
  try {
    const supabase: any = await createClient();

    const [ { data: history }, { data: comments } ] = await Promise.all([
      supabase
        .from("workflow_history")
        .select(`
          *,
          changed_by_profile:profiles!changed_by(first_name, last_name, email, role)
        `)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
      supabase
        .from("comments")
        .select(`
          *,
          author_profile:profiles!user_id(first_name, last_name, email, role)
        `)
        .eq("project_id", projectId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
    ]);

    return {
      success: true,
      data: {
        workflowHistory: history || [],
        comments: comments || []
      }
    };
  } catch (err) {
    console.error("getProjectActivityAction error:", err);
    return { success: false, error: "Failed to fetch project activity" };
  }
}

/**
 * uploadProjectFileAction
 * Strictly validates role-based file category permissions
 */
export async function uploadProjectFileAction(
  projectId: string,
  category: string,
  fileName: string,
  fileUrl: string
): Promise<WorkflowResponse> {
  try {
    const profile: any = await getUserProfileAction();
    if (!profile) return { success: false, error: "Unauthorized. Please log in." };

    const role = profile.role as Role;

    // Assignment Check
    const accessCheck = await verifyProjectAccess(projectId, profile.id, role, true);
    if (!accessCheck.isAllowed) {
      return { success: false, error: accessCheck.error || "Access denied." };
    }

    // Document Lock Check
    const lockCheck = await verifyProjectNotLocked(projectId);
    if (!lockCheck.success) {
      return { success: false, error: lockCheck.error || "Project is locked." };
    }

    // Category Check
    const categoryCheck = canUploadFileCategory(role, category);
    if (!categoryCheck.isAllowed) {
      return { success: false, error: categoryCheck.error || "Access denied." };
    }

    const supabase: any = await createClient();
    const { data: uploadedFile, error: insertError } = await supabase.from("files").insert({
      project_id: projectId,
      uploaded_by: profile.id,
      category: category,
      file_name: fileName,
      file_url: fileUrl,
      uploaded_at: new Date().toISOString()
    }).select().single();
    
    if (insertError) throw insertError;

    await logWorkflowAudit(supabase, projectId, profile.id, `Uploaded file: ${fileName} (${category})`);

    await supabase.from("activity_logs").insert({
      project_id: projectId,
      user_id: profile.id,
      action: "FILE_UPLOADED",
      details: { file_name: fileName, category },
      created_at: new Date().toISOString()
    });

    try {
      await notifySupplementalUploadAction(projectId);
    } catch (e) {
      console.error("Failed to notify supplemental upload", e);
    }

    revalidatePath(`/projects/${projectId}`);
    return { success: true, error: null, data: uploadedFile };
  } catch (err: any) {
    console.error("uploadProjectFileAction error:", err);
    return { success: false, error: err.message || "Failed to upload file" };
  }
}

/**
 * archiveProjectAction
 * Moves project to archived status and completes all pending tasks.
 */
export async function archiveProjectAction(
  projectId: string,
  satisfactionScore?: number,
  note?: string
): Promise<WorkflowResponse> {
  try {
    const profile: any = await getUserProfileAction();
    if (!profile) return { success: false, error: "Unauthorized. Please log in." };

    if (!['accountant', 'admin'].includes(profile?.role || '')) {
      return { success: false, error: "Only Accountants and Admins can archive projects." };
    }

    const supabase: any = await createClient();

    // 2. Update Project Status to Archived with satisfaction and notes
    const { data: updatedProject, error: updateError } = await supabase.from("projects").update({
      status: "archived",
      satisfaction_score: satisfactionScore,
      archival_note: note,
      updated_at: new Date().toISOString()
    }).eq("id", projectId).select().single();

    if (updateError) return { success: false, error: "Project not found or update failed." };

    // 3. Cleanup: Complete all remaining tasks
    await supabase.from("tasks")
      .update({
        status: "completed",
        completed_at: new Date().toISOString()
      })
      .eq("project_id", projectId)
      .neq("status", "completed");

    // 4. Log in History
    await supabase.from("workflow_history").insert({
      project_id: projectId,
      to_stage: "archived",
      changed_by: profile.id,
      comment: "Project archived and closed.",
      created_at: new Date().toISOString()
    });

    // 5. Log Activity
    await supabase.from("activity_logs").insert({
      project_id: projectId,
      user_id: profile.id,
      action: "PROJECT_ARCHIVED",
      details: { archived_by: profile.email },
      created_at: new Date().toISOString()
    });

    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/projects");
    return { success: true, error: null, data: updatedProject };
  } catch (err: any) {
    console.error("archiveProjectAction error:", err);
    return { success: false, error: err.message || "Failed to archive project" };
  }
}

/**
 * reopenProjectAction
 * Reopens a completed project by transitioning it back to data_sync
 */
export async function reopenProjectAction(
  projectId: string,
  reason: string,
  targetStage?: string
): Promise<WorkflowResponse> {
  try {
    const profile: any = await getUserProfileAction();
    if (!profile) return { success: false, error: "Unauthorized. Please log in." };

    if (!['admin', 'engineer'].includes(profile?.role || '')) {
      return { success: false, error: "Only Admins and Engineers can reopen projects." };
    }

    if (!reason || !reason.trim()) {
      return { success: false, error: "A reason for reopening the project must be provided." };
    }

    const supabase: any = await createClient();

    // 1. Verify project is completed
    const { data: project } = await supabase.from("projects").select("status, name, workflow_type").eq("id", projectId).single();
    if (project?.status !== 'completed' && project?.status !== 'delivered') {
      return { success: false, error: "Only completed projects can be reopened." };
    }

    const reopenStage = targetStage || 'data_collection';

    // 2. Update status
    const { data: updatedProject, error: updateError } = await supabase.from("projects").update({
      status: reopenStage,
      updated_at: new Date().toISOString()
    }).eq("id", projectId).select().single();

    if (updateError) return { success: false, error: "Failed to reopen project." };

    // 3. Log Activity
    await supabase.from("activity_logs").insert({
      project_id: projectId,
      user_id: profile.id,
      action: "PROJECT_REOPENED",
      details: { reopened_by: profile.email, reason, to_stage: reopenStage },
      created_at: new Date().toISOString()
    });

    // 4. Log Workflow History
    await supabase.from("workflow_history").insert({
      project_id: projectId,
      from_stage: project.status,
      to_stage: reopenStage,
      changed_by: profile.id,
      comment: `Project Reopened to ${reopenStage}. Reason: ${reason}`,
      created_at: new Date().toISOString()
    });

    // 5. Notify Team
    const [ { data: assignments }, { data: admins } ] = await Promise.all([
      supabase.from("project_assignments").select("user_id").eq("project_id", projectId),
      supabase.from("profiles").select("id").eq("role", "admin")
    ]);
    const recipientIds = new Set<string>((assignments || []).map((a: any) => a.user_id));
    (admins || []).forEach((a: any) => recipientIds.add(a.id));

    const { insertNotificationsBatch } = await import("@/actions/notification.actions");
    await insertNotificationsBatch(
      Array.from(recipientIds).map((userId: any) => ({
        userId,
        title: "Project Reopened ⚠️",
        message: `Project "${project.name}" has been reopened by ${profile.role}. Reason: ${reason}`,
        type: "stage_update",
        relatedProjectId: projectId
      }))
    );

    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/projects");
    return { success: true, error: null, data: updatedProject };
  } catch (err: any) {
    console.error("reopenProjectAction error:", err);
    return { success: false, error: err.message || "Failed to reopen project" };
  }
}


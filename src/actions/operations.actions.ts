"use server";

import { normalizeData } from '@/lib/normalize';

import { revalidatePath } from "next/cache";
import { getUserProfileAction } from "@/actions/auth.actions";
import {
  Role,
  verifyProjectAccess,
} from "@/lib/permissions/permissions";
import { requireProjectAccess } from "@/lib/permissions/project-access";
import { updateProjectStageAction } from "./workflow.actions";
import { addProjectCommentAction } from "./comment.actions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logWorkflowAudit } from "@/lib/workflow/logWorkflowAudit";


export type OpResponse<T = null> = {
  success: boolean;
  error: string | null;
  data?: T;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
}

async function getUserById(userId: string) {
  const supabase: any = await createClient();
  const { data: u } = await supabase.from('profiles').select('first_name, last_name, email, role').eq('id', userId).single();
  return u
    ? { first_name: u.first_name, last_name: u.last_name, email: u.email, role: u.role }
    : { first_name: "Unknown", last_name: "User", email: "", role: "hr" };
}

async function verifyProjectNotLocked(projectId: string): Promise<OpResponse> {
  try {
    const supabase: any = await createClient();
    const { data: project } = await supabase.from('projects').select('status, is_frozen').eq('id', projectId).single();
    if (project?.status === "completed" || project?.status === "archived") {
      return { success: false, error: "Project is locked (completed/archived) and cannot be modified." };
    }
    if (project?.is_frozen) {
      return { success: false, error: "PROJECT FROZEN: All operational work, task completions, and file uploads are disabled due to outstanding payments." };
    }
  } catch (err: any) {
    console.error("verifyProjectNotLocked error:", err);
  }
  return { success: true, error: null };
}

async function logActivity(
  projectId: string,
  userId: string,
  action: string,
  details: Record<string, any>
) {
  const supabase: any = await createClient();
  await supabase.from('activity_logs').insert({
    id: generateId("act"),
    project_id: projectId,
    user_id: userId,
    action,
    details,
    created_at: new Date().toISOString(),
  });
}

async function sendLocalNotification(
  userId: string,
  title: string,
  message: string,
  type: string,
  projectId: string
) {
  if (!userId || userId.trim() === '') return;
  const supabase: any = await createClient();
  await supabase.rpc('generate_system_notification', {
    p_target_user_id: userId,
    p_title: title,
    p_message: message,
    p_type: type,
    p_related_project_id: projectId
  });
}

import { insertNotificationsBatch } from "./notification.actions";

export async function sendLocalNotifications(
  userIds: string[],
  title: string,
  message: string,
  type: string,
  projectId?: string | null
) {
  if (!userIds || userIds.length === 0) return;
  const validIds = userIds.filter(id => id && id.trim() !== '');
  if (validIds.length === 0) return;

  const payloads = validIds.map(userId => ({
    userId,
    title,
    message,
    type: type as any,
    relatedProjectId: projectId || undefined
  }));

  const result = await insertNotificationsBatch(payloads);
  if (!result.success) {
    console.error("[sendLocalNotifications] batch insert error");
  }
}

async function getProjectName(projectId: string): Promise<string> {
  const supabase: any = await createClient();
  const { data: p } = await supabase.from('projects').select('name').eq('id', projectId).single();
  return p?.name || projectId;
}

export async function getOpsTeamMembersAction() {
  try {
    const supabase: any = await createClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, role, designation, is_active')
      .eq('is_active', true)
      .in('role', ['field', 'engineer'])
      .order('first_name');

    if (error) throw error;
    return { success: true, data: normalizeData(data || []) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ─── 1. ASSIGNMENT ENGINE ─────────────────────────────────────────────────────

export async function assignTeamMemberAction(
  projectId: string,
  userId: string,
  assignedRole: string
): Promise<OpResponse> {
  try {
    const auth = await requireProjectAccess(projectId, { requireUnlocked: true });
    if (!auth.authorized) return { success: false, error: auth.error || "Unauthorized." };

    if (!["admin", "engineer"].includes(auth.role))
      return { success: false, error: "Only Admins and Engineers can assign team members." };

    const supabase: any = await createClient();

    const { data: proj } = await supabase
      .from("projects")
      .select("id, status")
      .eq("id", projectId)
      .maybeSingle();

    if (!proj) {
      return {
        success: false,
        error: "Project not found."
      };
    }

    const supabaseAdmin: any = await createAdminClient();
    const { data: existing } = await supabase.from('project_assignments').select('id').eq('project_id', projectId).eq('user_id', userId).maybeSingle();
    if (existing)
      return { success: false, error: "User is already assigned to this project." };

    const newAssignment = {
      id: generateId("asg"),
      project_id: projectId,
      user_id: userId,
      role: assignedRole,
      assigned_by: auth.userId,
      assigned_at: new Date().toISOString(),
      status: "active",
    };
    const { error: insertError } = await supabaseAdmin.from('project_assignments').insert(newAssignment);
    if (insertError) throw new Error(insertError.message);

    await logWorkflowAudit(supabaseAdmin, projectId, auth.userId, `Assigned ${assignedRole} to project`);

    const assignedUser = await getUserById(userId);
    const projectName = await getProjectName(projectId);

    await logActivity(projectId, auth.userId, "TEAM_ASSIGNED", {
      assigned_user_id: userId,
      assigned_user_name: `${assignedUser.first_name} ${assignedUser.last_name}`,
      assigned_role: assignedRole,
      assigned_by: auth.userId,
    });

    await sendLocalNotification(
      userId,
      "Project Assignment",
      `You have been assigned to "${projectName}" as ${assignedRole}.`,
      "assignment",
      projectId
    );

    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/operations");
    return { success: true, error: null };
  } catch (err: any) {
    console.error("assignTeamMemberAction error:", err);
    return { success: false, error: err.message || "Failed to assign team member." };
  }
}

export async function claimProjectAction(projectId: string): Promise<OpResponse> {
  try {
    const auth = await requireProjectAccess(projectId, { requireUnlocked: true, requireAssignment: false });
    if (!auth.authorized) return { success: false, error: auth.error || "Unauthorized." };

    const allowedRoles = ["engineer", "field", "admin"];
    if (!allowedRoles.includes(auth.role)) {
       return { success: false, error: "Role not authorized to claim projects." };
    }

    const supabase: any = await createClient();

    const { data: existing } = await supabase
      .from('project_assignments')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', auth.userId)
      .single();

    if (existing) {
      return { success: false, error: "You are already assigned to this project." };
    }

    const { error: assignError } = await supabase.from('project_assignments').insert({
      id: generateId('asn'),
      project_id: projectId,
      user_id: auth.userId,
      role: auth.role,
      assigned_by: auth.userId
    });

    if (assignError) throw assignError;

    await supabase.from('activity_logs').insert({
      id: generateId('act'),
      project_id: projectId,
      user_id: auth.userId,
      action: 'TEAM_MEMBER_ASSIGNED',
      details: { 
        assigned_user: auth.userId, 
        role: auth.role,
        note: 'Project claimed by user'
      }
    });

    // Only auto-advance when still sitting in the engineer intake stage
    const { data: proj } = await supabase.from('projects').select('status').eq('id', projectId).single();
    if (auth.role === 'engineer' && proj?.status === 'project_created') {
      const { updateProjectStageAction } = await import('@/actions/workflow.actions');
      await updateProjectStageAction(projectId, 'data_collection', 'Engineer claimed project and started data collection.');
    }

    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/operations");
    revalidatePath("/engineer");
    revalidatePath("/field");
    return { success: true, error: null };
  } catch (err: any) {
    console.error("claimProjectAction error:", err);
    return { success: false, error: err.message || "Failed to claim project." };
  }
}

export async function removeTeamMemberAction(
  assignmentId: string,
  projectId: string
): Promise<OpResponse> {
  try {
    const auth = await requireProjectAccess(projectId, { requireUnlocked: true });
    if (!auth.authorized) return { success: false, error: auth.error || "Unauthorized." };

    if (!["admin", "engineer"].includes(auth.role))
      return { success: false, error: "Only Admins and Engineers can remove team members." };

    const supabase: any = await createClient();
    const { data: assignment } = await supabase.from('project_assignments').select('user_id, role').eq('id', assignmentId).single();
    if (!assignment) return { success: false, error: "Assignment not found." };

    await supabase.from('project_assignments').delete().eq('id', assignmentId);

    const removedUser = await getUserById(assignment.user_id);
    await logActivity(projectId, auth.userId, "TEAM_REMOVED", {
      removed_user_id: assignment.user_id,
      removed_user_name: `${removedUser.first_name} ${removedUser.last_name}`,
      removed_role: assignment.role,
    });

    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/operations");
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to remove team member." };
  }
}

export async function getTeamAssignmentsAction(projectId: string): Promise<OpResponse<any[]>> {
  try {
    const auth = await requireProjectAccess(projectId);
    if (!auth.authorized) return { success: false, error: auth.error || null, data: [] };

    const supabase: any = await createClient();
    const { data: assignments } = await supabase.from('project_assignments').select('*').eq('project_id', projectId);
    
    const userIds = Array.from(new Set((assignments || []).map((a: any) => a.user_id))).filter(Boolean);
    
    let profiles = [];
    if (userIds.length > 0) {
      const { data } = await supabase.from('profiles').select('id, first_name, last_name, email, role').in('id', userIds);
      profiles = data || [];
    }
    
    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

    const projectAssignments = (assignments || []).map((a: any) => ({
      ...a,
      user_profile: profileMap.get(a.user_id) || { first_name: "Unknown", last_name: "User", email: "", role: "hr" },
    }));
    return { success: true, error: null, data: projectAssignments };
  } catch (err: any) {
    return { success: false, error: err.message, data: [] };
  }
}

// ─── 2. REVISION & CAD WORKFLOW ────────────────────────────────────────────────

export type CADRevision = {
  id: string;
  project_id: string;
  submitted_by: string;
  title?: string;
  file_name: string;
  file_url: string;
  revision_number: number;
  revision_notes: string;
  status: "pending_review" | "approved" | "rejected" | "rework_requested";
  review_notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  revision_type?: string;
  submitted_at?: string;
  updated_at?: string;
  created_at: string;
  submitted_by_profile?: any;
  reviewed_by_profile?: any;
};

export async function submitCADRevisionAction(
  projectId: string,
  fileName: string,
  fileUrl: string,
  revisionNotes: string,
  revisionType: "prototype" | "final" = "prototype"
): Promise<OpResponse<CADRevision>> {
  try {
    const auth = await requireProjectAccess(projectId, { requireUnlocked: false });
    if (!auth.authorized) return { success: false, error: auth.error || "Unauthorized." } as any;

    if (!["cad", "engineer", "admin", "field"].includes(auth.role))
      return { success: false, error: "Only authorized technical users can submit revisions." } as any;

    const supabase: any = await createClient();
    const { data: projectRevisions } = await supabase.from('cad_revisions').select('status').eq('project_id', projectId);

    const { data: project } = await supabase.from('projects').select('bypass_active, workflow_type').eq('id', projectId).single();
    const rejectedCount = (projectRevisions || []).filter((r: any) => r.status === "rejected" || r.status === "rework_requested").length;

    if (rejectedCount >= 10 && !project?.bypass_active) {
      return {
        success: false,
        error: "REVISION LIMIT REACHED (Escalated Review Active): This project has reached the limit of 10 rejections and is currently locked under Escalation Hold. An Admin or Lead Engineer must verify parameters before further submissions."
      };
    }

    const revisionNumber = (projectRevisions || []).length + 1;

    const newRevision = {
      id: generateId("cad"),
      project_id: projectId,
      submitted_by: auth.userId,
      title: revisionType === "final" ? "Final Deliverable" : "Prototype Drawing",
      description: revisionNotes,
      files: [{ name: fileName, url: fileUrl }],
      revision_number: revisionNumber,
      status: "pending_review",
      revision_type: revisionType
    };

    const { data: insertedRevision, error: insertError } = await supabase.from('cad_revisions').insert(newRevision).select().single();
    if (insertError) throw new Error(insertError.message);

    const projectName = await getProjectName(projectId);
    await logActivity(projectId, auth.userId, "CAD_SUBMITTED", {
      revision_id: newRevision.id,
      revision_number: revisionNumber,
      file_name: fileName,
    });

    const { data: engineers } = await supabase.from('profiles').select('id').in('role', ['engineer', 'admin']);
    const engineerIds = (engineers || []).map((eng: any) => eng.id);
    await sendLocalNotifications(
      engineerIds,
      revisionType === "final" ? "Final Deliverable Submitted" : "Revision Submitted",
      `Revision #${revisionNumber} for "${projectName}" is ready for review.`,
      "approval",
      projectId
    );

    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/engineer");
    revalidatePath("/operations");
    return { success: true, error: null, data: insertedRevision as any };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to submit revision." };
  }
}

export async function approveCADRevisionAction(
  revisionId: string,
  projectId: string,
  reviewNote?: string
): Promise<OpResponse<any>> {
  try {
    const auth = await requireProjectAccess(projectId, { requireUnlocked: true });
    if (!auth.authorized) return { success: false, error: auth.error || "Unauthorized." };

    if (!["engineer", "admin"].includes(auth.role))
      return { success: false, error: "Only Engineers or Admins can approve revisions." };

    const supabase: any = await createClient();

    const { data: updatedRevision, error: updateError } = await supabase.from('cad_revisions').update({
      status: "approved",
      reviewed_by: auth.userId,
      reviewed_at: new Date().toISOString(),
      review_notes: reviewNote || "Approved.",
    }).eq('id', revisionId).select().single();
    if (updateError) return { success: false, error: "Revision not found." };

    const revision = updatedRevision;
    const projectName = await getProjectName(projectId);

    await logActivity(projectId, auth.userId, "CAD_APPROVED", {
      revision_id: revisionId,
      review_notes: reviewNote,
    });

    if (revision?.submitted_by) {
      await sendLocalNotification(
        revision.submitted_by,
        "Revision Approved ✓",
        `Your revision for "${projectName}" has been approved.`,
        "approval",
        projectId
      );
    }

    const { data: projectInfo } = await supabase.from('projects').select('status').eq('id', projectId).single();
    if (projectInfo?.status === "final_review" || projectInfo?.status === "data_sync") {
      await updateProjectStageAction(projectId, "completed", "Final Deliverable Approved. Delivered to Client.");
    }

    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/engineer");
    revalidatePath("/operations");
    return { success: true, error: null, data: updatedRevision as any };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to approve revision." };
  }
}

export async function rejectCADRevisionAction(
  revisionId: string,
  projectId: string,
  rejectionReason: string
): Promise<OpResponse<any>> {
  try {
    const auth = await requireProjectAccess(projectId, { requireUnlocked: false });
    if (!auth.authorized) return { success: false, error: auth.error || "Unauthorized." };

    if (!["engineer", "admin"].includes(auth.role))
      return { success: false, error: "Only Engineers or Admins can reject revisions." };

    const supabase: any = await createClient();

    const { data: updatedRevision, error: updateError } = await supabase.from('cad_revisions').update({
      status: "rework_requested",
      reviewed_by: auth.userId,
      reviewed_at: new Date().toISOString(),
      review_notes: rejectionReason,
    }).eq('id', revisionId).select().single();
    if (updateError) return { success: false, error: "Revision not found." };

    const revision = updatedRevision;
    const projectName = await getProjectName(projectId);

    await logActivity(projectId, auth.userId, "CAD_REJECTED", {
      revision_id: revisionId,
      rejection_reason: rejectionReason,
    });

    await addProjectCommentAction(projectId, `[Rework Requested] ${rejectionReason}`, 'rejection');

    const { data: projectInfo } = await supabase.from('projects').select('status').eq('id', projectId).single();
    if (projectInfo?.status === "final_review") {
      await updateProjectStageAction(projectId, 'final_review', `Final deliverable rejected. Rework requested. Reason: ${rejectionReason}`);
    } else if (projectInfo?.status === "data_sync") {
      await updateProjectStageAction(projectId, 'field_work', `Data sync rejected. Rework requested. Reason: ${rejectionReason}`);
    }

    if (revision?.submitted_by) {
      await sendLocalNotification(
        revision.submitted_by,
        "Revision Rejected — Rework Requested",
        `Your revision for "${projectName}" was rejected: ${rejectionReason.slice(0, 100)}`,
        "rejection",
        projectId
      );
    }

    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/engineer");
    revalidatePath("/operations");
    return { success: true, error: null, data: updatedRevision as any };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to reject revision." };
  }
}

export async function bypassCADEscalationAction(projectId: string): Promise<OpResponse<any>> {
  try {
    const auth = await requireProjectAccess(projectId, { requireUnlocked: true });
    if (!auth.authorized) return { success: false, error: auth.error || "Unauthorized." };

    if (!["admin", "engineer"].includes(auth.role)) {
      return { success: false, error: "Only Admin or Lead Engineer can authorize escalation bypass." };
    }

    const supabase: any = await createClient();
    const { data: updatedProject, error: updateError } = await supabase.from('projects').update({
      bypass_active: true,
      updated_at: new Date().toISOString()
    }).eq('id', projectId).select().single();
    if (updateError) return { success: false, error: "Project not found." };

    await logActivity(projectId, auth.userId, "ESCALATION_BYPASSED", {
      authorized_by: auth.userId
    });

    revalidatePath(`/projects/${projectId}`);
    return { success: true, error: null, data: updatedProject as any };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to bypass escalation." };
  }
}

export async function getCADRevisionsAction(projectId: string): Promise<OpResponse<CADRevision[]>> {
  try {
    const auth = await requireProjectAccess(projectId);
    if (!auth.authorized) return { success: false, error: auth.error || null, data: [] };

    const supabase: any = await createClient();
    let { data: revisions, error: queryError } = await supabase
      .from('cad_revisions')
      .select('id, project_id, submitted_by, title, files, revision_number, description, status, review_notes, reviewed_by, reviewed_at, submitted_at, updated_at, revision_type')
      .eq('project_id', projectId)
      .order('submitted_at', { ascending: false });
    
    if (queryError) {
      console.error("getCADRevisionsAction query error:", queryError);
      return { success: false, error: queryError.message, data: [] };
    }

    // Auto-heal / sync: If cad_revisions has no survey rejections yet, check if there are prior survey rejection activity logs
    if (!revisions || revisions.length === 0) {
      try {
        const adminClient: any = createAdminClient();
        const { data: rejectLogs } = await adminClient
          .from('activity_logs')
          .select('id, user_id, details, created_at')
          .eq('project_id', projectId)
          .eq('action', 'FIELD_SURVEY_REJECTED')
          .order('created_at', { ascending: true });

        if (rejectLogs && rejectLogs.length > 0) {
          const { data: fieldAssignments } = await adminClient
            .from('project_assignments')
            .select('user_id')
            .eq('project_id', projectId)
            .eq('role', 'field');
          const fieldUserId = (fieldAssignments && fieldAssignments.length > 0) ? fieldAssignments[0].user_id : auth.userId;

          const { data: surveyFiles } = await adminClient
            .from('files')
            .select('file_name, file_url')
            .eq('project_id', projectId)
            .in('category', ['survey_data', 'control_point_csv', 'control_point_image']);

          for (let i = 0; i < rejectLogs.length; i++) {
            const log = rejectLogs[i];
            const reason = log.details?.reviewNotes || log.details?.reason || 'Rework required';
            const newRev = {
              id: `rev-hist-${log.id}`,
              project_id: projectId,
              submitted_by: fieldUserId,
              title: "Field Survey Data",
              description: `Field Survey rejected by Engineer. Reason: ${reason}`,
              files: (surveyFiles || []).map((f: any) => ({ name: f.file_name, url: f.file_url })),
              revision_number: i + 1,
              status: "rework_requested",
              revision_type: "survey",
              reviewed_by: log.user_id,
              reviewed_at: log.created_at,
              review_notes: `Rework Requested by Engineer. Reason: ${reason}`,
              submitted_at: log.created_at,
              updated_at: log.created_at
            };
            await adminClient.from('cad_revisions').insert(newRev);
          }

          const { data: refetched } = await supabase
            .from('cad_revisions')
            .select('id, project_id, submitted_by, title, files, revision_number, description, status, review_notes, reviewed_by, reviewed_at, submitted_at, updated_at, revision_type')
            .eq('project_id', projectId)
            .order('submitted_at', { ascending: false });
          revisions = refetched || [];
        }
      } catch (syncErr) {
        console.error("Failed to sync historical survey revisions:", syncErr);
      }
    }

    const userIds = Array.from(new Set((revisions || []).flatMap((r: any) => [r.submitted_by, r.reviewed_by]))).filter(Boolean);
    let profiles: any[] = [];
    if (userIds.length > 0) {
      const { data } = await supabase.from('profiles').select('id, first_name, last_name, email, role').in('id', userIds);
      profiles = data || [];
    }
    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

    const data = (revisions || []).map((r: any) => {
      const file = Array.isArray(r.files) && r.files.length > 0 ? r.files[0] : {};
      return {
        ...r,
        title: r.title || (r.revision_type === 'survey' ? 'Field Survey Data' : 'Final Deliverable'),
        file_name: file.name || r.title || 'Revision Document',
        file_url: file.url || '',
        revision_notes: r.description || '',
        created_at: r.submitted_at || r.updated_at || new Date().toISOString(),
        submitted_by_profile: profileMap.get(r.submitted_by) || { first_name: "Field", last_name: "Team", email: "", role: "field" },
        reviewed_by_profile: r.reviewed_by ? (profileMap.get(r.reviewed_by) || { first_name: "Engineer", last_name: "", email: "", role: "engineer" }) : null,
      };
    });
    data.sort((a: any, b: any) => b.revision_number - a.revision_number);
    return { success: true, error: null, data };
  } catch (err: any) {
    return { success: false, error: err.message, data: [] };
  }
}

export async function reviewLatestCADRevisionAction(
  projectId: string,
  isApproved: boolean,
  reason: string
): Promise<OpResponse<any>> {
  const revisionsRes = await getCADRevisionsAction(projectId);
  if (!revisionsRes.success) return { success: false, error: revisionsRes.error };

  const pendingRevision = revisionsRes.data?.find((r: any) => r.status === "pending_review");
  if (!pendingRevision) {
    return { success: false, error: "Validation failed: No pending revision found for this project." };
  }

  if (isApproved) {
    return await approveCADRevisionAction(pendingRevision.id, projectId, reason);
  } else {
    return await rejectCADRevisionAction(pendingRevision.id, projectId, reason);
  }
}

// ─── 3. FIELD WORKFLOW ────────────────────────────────────────────────────────

export type FieldReport = {
  id: string;
  project_id: string;
  submitted_by: string;
  report_type: "progress" | "completion" | "issue";
  content: string;
  issues_identified?: string;
  attachments?: any[];
  status: "submitted" | "acknowledged" | "resolved";
  created_at: string;
};

export async function submitFieldReportAction(
  projectId: string,
  reportType: "progress" | "completion" | "issue",
  description: string,
  locationNotes?: string
): Promise<OpResponse<FieldReport>> {
  try {
    const profile: any = await getUserProfileAction();
    if (!profile) return { success: false, error: "Unauthorized." };

    const lockCheck = await verifyProjectNotLocked(projectId);
    if (!lockCheck.success) return lockCheck as any;
    if (!["field", "admin"].includes(profile.role))
      return { success: false, error: "Only Field Engineers can submit reports." };

    const accessCheck = await verifyProjectAccess(projectId, profile.id, profile.role as Role, true);
    if (!accessCheck.isAllowed) return { success: false, error: accessCheck.error || "Access denied." };

    const report: FieldReport = {
      id: generateId("fld"),
      project_id: projectId,
      submitted_by: profile.id,
      report_type: reportType,
      content: description,
      issues_identified: locationNotes,
      status: "submitted",
      created_at: new Date().toISOString(),
    };

    const supabase: any = await createClient();
    await supabase.from('field_reports').insert(report);

    const actionMap = {
      progress: "FIELD_PROGRESS_REPORTED",
      completion: "FIELD_SURVEY_COMPLETED",
      issue: "FIELD_ISSUE_REPORTED",
    };

    await logActivity(projectId, profile.id, actionMap[reportType], {
      report_id: report.id,
      description: description.slice(0, 200),
    });

    const projectName = await getProjectName(projectId);

    if (reportType === "issue") {
      const { data: engineers } = await supabase.from('profiles').select('id').in('role', ['engineer', 'admin']);
      const engineerIds = (engineers || []).map((eng: any) => eng.id);
      await sendLocalNotifications(
        engineerIds,
        "⚠️ Field Issue Reported",
        `Field issue on "${projectName}": ${description.slice(0, 100)}`,
        "rejection",
        projectId
      );
    }

    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/field");
    return { success: true, error: null, data: report };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to submit field report." };
  }
}

export async function getFieldReportsAction(projectId: string): Promise<OpResponse<FieldReport[]>> {
  try {
    const auth = await requireProjectAccess(projectId);
    if (!auth.authorized) return { success: false, error: auth.error || null, data: [] };

    const supabase: any = await createClient();
    const { data: reports } = await supabase.from('field_reports').select('id, project_id, report_date, content, issues_identified, attachments, status, submitted_by, created_at').eq('project_id', projectId).order('created_at', { ascending: false }).limit(100);
    
    const userIds = Array.from(new Set((reports || []).map((r: any) => r.submitted_by))).filter(Boolean);
    let profiles: any[] = [];
    if (userIds.length > 0) {
      const { data } = await supabase.from('profiles').select('id, first_name, last_name, email, role').in('id', userIds);
      profiles = data || [];
    }
    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

    const data = (reports || []).map((r: any) => ({
      ...r,
      submitted_by_profile: profileMap.get(r.submitted_by) || { first_name: "Unknown", last_name: "User", email: "", role: "hr" },
    }));
    data.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return { success: true, error: null, data };
  } catch (err: any) {
    return { success: false, error: err.message, data: [] };
  }
}

export async function acceptFieldAssignmentAction(projectId: string): Promise<OpResponse> {
  try {
    const profile: any = await getUserProfileAction();
    if (!profile) return { success: false, error: "Unauthorized." };

    const lockCheck = await verifyProjectNotLocked(projectId);
    if (!lockCheck.success) return lockCheck;
    if (!["field", "admin"].includes(profile.role))
      return { success: false, error: "Only Field Engineers can accept field assignments." };

    await updateProjectStageAction(projectId, "field_work", "Field Engineer accepted the assignment and started work.");

    const supabase: any = await createClient();
    const { data: existing } = await supabase.from('project_assignments').select('id').eq('project_id', projectId).eq('user_id', profile.id).maybeSingle();

    if (!existing) {
      await supabase.from('project_assignments').insert({
        id: generateId("asg"),
        project_id: projectId,
        user_id: profile.id,
        role: "field",
        assigned_by: profile.id,
        assigned_at: new Date().toISOString(),
        status: "active",
      });
    }

    await logActivity(projectId, profile.id, "FIELD_ASSIGNMENT_ACCEPTED", { user_id: profile.id });

    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/field");
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function submitFieldSurveyAction(
  projectId: string,
  description: string,
  locationNotes: string
): Promise<OpResponse> {
  try {
    const res = await submitFieldReportAction(projectId, "completion", description, locationNotes);
    if (!res.success) return { success: false, error: res.error };

    await updateProjectStageAction(projectId, "data_sync", "Field Survey completed. Awaiting review.");

    const profile: any = await getUserProfileAction();
    await logActivity(projectId, profile?.id || "sys", "FIELD_SURVEY_SUBMITTED", { description });

    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/field");
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function reviewFieldSurveyAction(
  projectId: string,
  isApproved: boolean,
  reviewNotes: string
): Promise<OpResponse> {
  try {
    const auth = await requireProjectAccess(projectId, { requireUnlocked: true });
    if (!auth.authorized) return { success: false, error: auth.error || "Unauthorized." };

    if (!["engineer", "admin"].includes(auth.role))
      return { success: false, error: "Only Engineers or Admins can review field surveys." };

    if (isApproved) {
      // Gate: All assigned materials and equipment must be submitted before survey can be validated
      const supabase: any = await createClient();
      const { data: unsubmittedMaterials } = await supabase
        .from('material_requests')
        .select('id, item_name, quantity')
        .eq('project_id', projectId)
        .in('status', ['assigned', 'requested']);

      if (unsubmittedMaterials && unsubmittedMaterials.length > 0) {
        const itemNames = unsubmittedMaterials.map((m: any) => `${m.quantity}x ${m.item_name}`).join(', ');
        return {
          success: false,
          error: `Cannot validate field survey: All assigned materials and equipment must be submitted to the company or reported missing/lost with responsible member (${itemNames}).`
        };
      }

      const stRes = await updateProjectStageAction(projectId, "final_review", `Field Survey Accepted. Ready for Final Deliverables. Notes: ${reviewNotes}`);
      if (!stRes.success) return stRes;
      await logActivity(projectId, auth.userId, "FIELD_SURVEY_APPROVED", { reviewNotes });

      try {
        const adminClient: any = createAdminClient();
        const { data: existingRevisions } = await adminClient
          .from('cad_revisions')
          .select('id')
          .eq('project_id', projectId);
        const revisionNumber = (existingRevisions || []).length + 1;

        const { data: surveyFiles } = await adminClient
          .from('files')
          .select('file_name, file_url')
          .eq('project_id', projectId)
          .in('category', ['survey_data', 'control_point_csv', 'control_point_image']);

        const { data: fieldAssignments } = await adminClient
          .from('project_assignments')
          .select('user_id')
          .eq('project_id', projectId)
          .eq('role', 'field');
        const fieldUserId = (fieldAssignments && fieldAssignments.length > 0) ? fieldAssignments[0].user_id : auth.userId;

        await adminClient.from('cad_revisions').insert({
          id: generateId("rev"),
          project_id: projectId,
          submitted_by: fieldUserId,
          title: "Field Survey Data",
          description: reviewNotes ? `Field Survey Approved: ${reviewNotes}` : "Field survey validated and approved by Engineer.",
          files: (surveyFiles || []).map((f: any) => ({ name: f.file_name, url: f.file_url })),
          revision_number: revisionNumber,
          status: "approved",
          revision_type: "survey",
          reviewed_by: auth.userId,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes || "Approved by Engineer"
        });
      } catch (revErr) {
        console.error("Failed to record survey approval in cad_revisions:", revErr);
      }
    } else {
      const stRes = await updateProjectStageAction(projectId, "field_work", `Field Survey Rejected. Reason: ${reviewNotes}`);
      if (!stRes.success) return stRes;
      await logActivity(projectId, auth.userId, "FIELD_SURVEY_REJECTED", { reviewNotes });
      await addProjectCommentAction(projectId, `[Survey Rejection] ${reviewNotes}`, "rejection");

      try {
        const adminClient: any = createAdminClient();
        const { data: existingRevisions } = await adminClient
          .from('cad_revisions')
          .select('id')
          .eq('project_id', projectId);
        const revisionNumber = (existingRevisions || []).length + 1;

        const { data: surveyFiles } = await adminClient
          .from('files')
          .select('file_name, file_url')
          .eq('project_id', projectId)
          .in('category', ['survey_data', 'control_point_csv', 'control_point_image']);

        const { data: fieldAssignments } = await adminClient
          .from('project_assignments')
          .select('user_id')
          .eq('project_id', projectId)
          .eq('role', 'field');
        const fieldUserId = (fieldAssignments && fieldAssignments.length > 0) ? fieldAssignments[0].user_id : auth.userId;

        await adminClient.from('cad_revisions').insert({
          id: generateId("rev"),
          project_id: projectId,
          submitted_by: fieldUserId,
          title: "Field Survey Data",
          description: `Field Survey rejected by Engineer. Reason: ${reviewNotes}`,
          files: (surveyFiles || []).map((f: any) => ({ name: f.file_name, url: f.file_url })),
          revision_number: revisionNumber,
          status: "rework_requested",
          revision_type: "survey",
          reviewed_by: auth.userId,
          reviewed_at: new Date().toISOString(),
          review_notes: `Rework Requested by Engineer. Reason: ${reviewNotes}`
        });
      } catch (revErr) {
        console.error("Failed to record survey rejection in cad_revisions:", revErr);
      }

      // Notify field workers
      const assignRes = await getTeamAssignmentsAction(projectId);
      if (assignRes.success && assignRes.data) {
        const fieldUserIds = assignRes.data
          .filter((a: any) => ["field"].includes(a.role))
          .map((a: any) => a.user_id);
        
        if (fieldUserIds.length > 0) {
          await sendLocalNotifications(
            fieldUserIds,
            "Field Survey Rejected",
            `Your survey for this project was rejected. Reason: ${reviewNotes}`,
            "rejection",
            projectId
          );
        }
      }
    }

    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/field");
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function engineerApproveSurveyDataAction(
  projectId: string,
  isApproved: boolean,
  reviewNotes: string
): Promise<OpResponse> {
  try {
    const auth = await requireProjectAccess(projectId, { requireUnlocked: true });
    if (!auth.authorized) return { success: false, error: auth.error || "Unauthorized." };

    if (!["engineer", "admin"].includes(auth.role))
      return { success: false, error: "Only Engineers can validate field data." };

    if (isApproved) {
      await updateProjectStageAction(projectId, "final_review", `Engineer Data Validated. Ready for Final Deliverables. Notes: ${reviewNotes}`);
      await logActivity(projectId, auth.userId, "ENGINEER_DATA_APPROVED", { reviewNotes });
    } else {
      await updateProjectStageAction(projectId, "field_work", `Engineer Data Validation Rejected. Reason: ${reviewNotes}`);
      await logActivity(projectId, auth.userId, "ENGINEER_DATA_REJECTED", { reviewNotes });
      await addProjectCommentAction(projectId, `[Engineer Data Rejection] ${reviewNotes}`, "rejection");
    }

    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/engineer");
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function logFieldVisitAction(
  projectId: string,
  visitDate: string,
  description?: string,
  price?: number
): Promise<OpResponse<any>> {
  try {
    const profile: any = await getUserProfileAction();
    if (!profile) return { success: false, error: "Unauthorized." };

    const lockCheck = await verifyProjectNotLocked(projectId);
    if (!lockCheck.success) return lockCheck;
    if (!["field", "engineer", "admin", "accountant"].includes(profile.role))
      return { success: false, error: "Only Field Engineers, Engineers, Admins, or Accountants can log visits." };

    const accessCheck = await verifyProjectAccess(projectId, profile.id, profile.role as Role, true);
    if (!accessCheck.isAllowed) return { success: false, error: accessCheck.error || "Access denied." };

    const supabase: any = await createClient();

    // Auto-assign existing field engineers for this project to the new visit
    const { data: assignments } = await supabase
      .from('project_assignments')
      .select('user_id')
      .eq('project_id', projectId)
      .eq('role', 'field');
      
    const assignedFieldEngineers = assignments ? assignments.map((a: any) => a.user_id) : [];

    const newVisit = {
      id: generateId("vst"),
      project_id: projectId,
      scheduled_date: visitDate,
      status: "scheduled",
      purpose: description || "Scheduled from Milestones Portal",
      assigned_team: assignedFieldEngineers,
      visit_cost: price || 0,
      is_billable: price ? true : false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error: insertErr } = await supabase.from('project_visits').insert(newVisit);
    if (insertErr) return { success: false, error: insertErr.message };

    await logActivity(projectId, profile.id, "FIELD_VISIT_SCHEDULED", {
      visit_id: newVisit.id,
      visit_date: visitDate,
      price: price || 0
    });

    revalidatePath(`/projects/${projectId}`);
    return { success: true, error: null, data: { ...newVisit, visit_date: newVisit.scheduled_date, price: newVisit.visit_cost } };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to schedule field visit." };
  }
}

export async function completeFieldVisitAction(
  visitId: string,
  projectId: string
): Promise<OpResponse> {
  try {
    const profile: any = await getUserProfileAction();
    if (!profile) return { success: false, error: "Unauthorized." };

    const lockCheck = await verifyProjectNotLocked(projectId);
    if (!lockCheck.success) return lockCheck;
    if (!["field", "engineer", "admin"].includes(profile.role))
      return { success: false, error: "Only Field Engineers, Engineers, or Admins can modify visits." };

    const supabase: any = await createClient();
    const { error: updateError } = await supabase.from('project_visits').update({
      status: "completed",
      completed_date: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString()
    }).eq('id', visitId);

    if (updateError) return { success: false, error: "Visit record not found." };

    const projectName = await getProjectName(projectId);
    await logActivity(projectId, profile.id, "FIELD_VISIT_COMPLETED", { visit_id: visitId });

    const { data: accountants } = await supabase.from('profiles').select('id').in('role', ['accountant', 'admin']);
    const accountantIds = (accountants || []).map((acc: any) => acc.id);
    await sendLocalNotifications(
      accountantIds,
      "Visit Completed (Ready to Invoice)",
      `A field visit for "${projectName}" has been completed and is ready for invoicing.`,
      "billing",
      projectId
    );

    revalidatePath(`/projects/${projectId}`);
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to complete visit." };
  }
}

// ─── 6. OPERATIONS QUEUE QUERIES ─────────────────────────────────────────────

export async function getOperationsQueueAction() {
  try {
    const profile: any = await getUserProfileAction();
    if (!profile) return { success: false, error: "Unauthorized.", data: null };

    const supabase: any = await createClient();

    const role = profile.role as Role;
    const operationalStages = [
      "project_created",
      "data_collection",
      "prototype",
      "field_work",
      "data_sync",
      "review",

      "completed",
    ];

    let [{ data: projects }, { data: assignments }] = await Promise.all([
      supabase.from('projects').select('*').is('deleted_at', null).neq('id', 'PRJ-PRINT-DESK').in('status', operationalStages),
      supabase.from('project_assignments').select('*')
    ]);

    if (!projects) projects = [];

    let filteredProjects = projects;

    if (!["admin", "sales", "accountant"].includes(role)) {
      const assignedIds = (assignments || [])
        .filter((a: any) => a.user_id === profile.id)
        .map((a: any) => a.project_id);
      filteredProjects = filteredProjects.filter((p: any) => assignedIds.includes(p.id));
    }

    const allUserIds = Array.from(new Set()).filter(Boolean);
    const { data: profiles } = await supabase.from('profiles').select('id, first_name, last_name, email, role').in('id', allUserIds);
    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

    const enriched = filteredProjects.map((p: any) => {
      const projectAssigments = (assignments || []).filter((a: any) => a.project_id === p.id);
      const team = projectAssigments.map((a: any) => ({
        ...a,
        user_profile: profileMap.get(a.user_id) || { first_name: "Unknown", last_name: "User", email: "", role: "hr" }
      }));
      return { ...p, team };
    });

    const queue = {
      active: enriched.filter((p: any) =>
        ["project_created", "data_collection", "prototype"].includes(p.status)
      ),
      field: enriched.filter((p: any) =>
        ["field_work", "data_sync"].includes(p.status)
      ),
      review: enriched.filter((p: any) =>
        ["review"].includes(p.status)
      ),
      completed: enriched.filter((p: any) => p.status === "completed"),
      all: enriched,
    };

    return { success: true, error: null, data: queue };
  } catch (err: any) {
    console.error("getOperationsQueueAction error:", err);
    return { success: false, error: err.message, data: null };
  }
}

export async function getMyAssignedProjectsAction() {
  try {
    const profile: any = await getUserProfileAction();
    if (!profile) return { success: false, error: "Unauthorized.", data: [] };

    const supabase: any = await createClient();
    const { data: assignments } = await supabase.from('project_assignments').select('*').eq('user_id', profile.id);
    const assignedProjectIds = new Set((assignments || []).map((a: any) => a.project_id));
    
    // Include unassigned projects in 'project_created' phase for engineers (and admins) to claim/view
    if (profile.role === 'engineer' || profile.role === 'admin') {
      const { data: createdProjects } = await supabase.from('projects').select('id').eq('status', 'project_created').is('deleted_at', null).neq('id', 'PRJ-PRINT-DESK');
      if (createdProjects && createdProjects.length > 0) {
        const createdIds = createdProjects.map((p: any) => p.id);
        const { data: engineerAssignments } = await supabase.from('project_assignments').select('project_id').in('project_id', createdIds).eq('role', 'engineer');
        const assignedEngineersSet = new Set((engineerAssignments || []).map((a: any) => a.project_id));
        
        createdIds.forEach((id: string) => {
          if (!assignedEngineersSet.has(id)) {
            assignedProjectIds.add(id);
          }
        });
      }
    }



    // Include unassigned projects in 'field_assigned' phase for field roles to claim/view
    if (['field', 'admin'].includes(profile.role)) {
      const { data: fieldProjects } = await supabase.from('projects').select('id').eq('status', 'field_assigned').is('deleted_at', null).neq('id', 'PRJ-PRINT-DESK');
      if (fieldProjects && fieldProjects.length > 0) {
        const fieldIds = fieldProjects.map((p: any) => p.id);
        const { data: fieldAssignments } = await supabase.from('project_assignments').select('project_id').in('project_id', fieldIds).in('role', ['field']);
        const assignedFieldSet = new Set((fieldAssignments || []).map((a: any) => a.project_id));
        
        fieldIds.forEach((id: string) => {
          if (!assignedFieldSet.has(id)) {
            assignedProjectIds.add(id);
          }
        });
      }
    }

    const projectIdsArray = Array.from(assignedProjectIds);

    let projects = [];
    if (projectIdsArray.length > 0) {
      const res = await supabase.from('projects').select('*').is('deleted_at', null).neq('id', 'PRJ-PRINT-DESK').in('id', projectIdsArray);
      projects = res.data || [];
    }

    const myProjects = (projects || [])
      .map((p: any) => ({
        ...p,
        my_role: (assignments || []).find((a: any) => a.project_id === p.id)?.role,
        assigned_at: (assignments || []).find((a: any) => a.project_id === p.id)?.assigned_at,
      }))
      .sort(
        (a: any, b: any) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );

    return { success: true, error: null, data: myProjects };
  } catch (err: any) {
    return { success: false, error: err.message, data: [] };
  }
}

export async function getProjectActivityAction(projectId: string) {
  try {
    const supabase: any = await createClient();
    const { data: activityLogs } = await supabase.from('activity_logs').select('*').eq('project_id', projectId);

    const userIds = Array.from(new Set()).filter(Boolean);
    const { data: profiles } = await supabase.from('profiles').select('id, first_name, last_name, email, role').in('id', userIds);
    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

    const logs = (activityLogs || []).map((l: any) => ({
      ...l,
      user_profile: profileMap.get(l.user_id) || { first_name: "Unknown", last_name: "User", email: "", role: "hr" },
    }));

    logs.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return { success: true, error: null, data: logs };
  } catch (err: any) {
    return { success: false, error: err.message, data: [] };
  }
}





export async function getFieldVisitsAction(projectId: string): Promise<OpResponse<any[]>> {
  try {
    const profile: any = await getUserProfileAction();
    if (!profile) return { success: false, error: "Unauthorized.", data: [] };

    const supabase: any = await createClient();
    const { data, error } = await supabase.from('project_visits').select('*').eq('project_id', projectId).order('scheduled_date', { ascending: false });
    if (error) return { success: false, error: error.message };
    
    const mapped = (data || []).map((v: any) => ({
      ...v,
      visit_date: v.scheduled_date,
      price: v.visit_cost
    }));
    
    return { success: true, error: null, data: mapped };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getDeliveryChecklistAction(projectId: string): Promise<OpResponse<any>> {
  try {
    const supabase: any = await createClient();
    const { data, error } = await supabase.from('delivery_checklist').select('*').eq('project_id', projectId).maybeSingle();
    if (error) return { success: false, error: error.message };
    return { success: true, error: null, data: data || null };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}



import React, { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { 
  ArrowLeft, 
  Calendar, 
  Hash, 
  ChevronRight,
  Phone,
  Lock
} from "lucide-react";
import Link from "next/link";
import { cn, filterActivityLogsByRole, maskPhone } from "@/lib/utils";


import { StageDependentLockBanner } from "@/components/modules/StageDependentLockBanner";
import {
  getCADRevisionsAction,
  getFieldReportsAction,
} from "@/actions/operations.actions";
import { getMilestonesAction } from "@/actions/finance.actions";

import { getUserProfileAction } from "@/actions/auth.actions";
import { ProjectDetailTabs } from "@/components/modules/ProjectDetailTabs";
import { verifyProjectAccess } from "@/lib/permissions/permissions";
import { ProjectDeleteButton } from "@/components/modules/ProjectDeleteButton";

const ROLE_THEME: Record<string, { primary: string; hover: string; text: string; bg: string; border: string; glow: string }> = {
  admin:      { primary: "indigo-600", hover: "hover:text-indigo-600 dark:hover:text-indigo-400", text: "text-indigo-500", bg: "bg-indigo-500/10", border: "border-indigo-500/20", glow: "bg-indigo-600/10" },
  sales:      { primary: "indigo-600", hover: "hover:text-indigo-600 dark:hover:text-indigo-400", text: "text-indigo-500", bg: "bg-indigo-500/10", border: "border-indigo-500/20", glow: "bg-indigo-600/10" },
  accountant: { primary: "indigo-600", hover: "hover:text-indigo-600 dark:hover:text-indigo-400", text: "text-indigo-500", bg: "bg-indigo-500/10", border: "border-indigo-500/20", glow: "bg-indigo-600/10" },
  engineer:   { primary: "indigo-600", hover: "hover:text-indigo-600 dark:hover:text-indigo-400", text: "text-indigo-500", bg: "bg-indigo-500/10", border: "border-indigo-500/20", glow: "bg-indigo-600/10" },
  field:      { primary: "indigo-600", hover: "hover:text-indigo-600 dark:hover:text-indigo-400", text: "text-indigo-500", bg: "bg-indigo-500/10", border: "border-indigo-500/20", glow: "bg-indigo-600/10" },
};

const ROLE_REDIRECTS: Record<string, string> = {
  admin: "/admin",
  sales: "/sales",
  accountant: "/accounts",
  engineer: "/engineer",
  field: "/field",
};

const getNextRequiredAction = (status: string, files: any[], assignments: any[], activityLogs: any[]) => {
  const isQcRejected = activityLogs.some((l: any) => l.action === "QC_REJECTED") && 
    !activityLogs.some((l: any) => l.action === "QC_APPROVED") && 
    (status === "data_sync" || status === "review");

  if (isQcRejected) {
    return {
      title: "QC Rework Request",
      description: "Address the QC reviewer's rejection notes, coordinate corrections with the field team, and re-submit.",
      badge: "Returned By QC",
      color: "text-rose-600 bg-rose-500/10 border-rose-500/20 dark:text-rose-450 dark:bg-rose-500/[0.05]"
    };
  }

  switch (status) {
    case 'project_created':
    case 'data_collection':
      const intakeFiles = files.filter((f: any) => ['requirements', 'receipt', 'intake_document'].includes(f.category));
      
      if (intakeFiles.length === 0) {
        return {
          title: "Collect Client Documents",
          description: "Upload necessary client site measurements, requirements, receipts, and intake documentation in the Operations tab.",
          badge: status === 'project_created' ? "Requires Client Contact" : "Document Collection",
          color: "text-indigo-600 bg-indigo-500/10 border-indigo-500/20 dark:text-indigo-400 dark:bg-indigo-500/[0.05]"
        };
      } else {
        return {
          title: "Technical Field Preparation",
          description: "Review client documents and dispatch field team for survey data collection.",
          badge: "Ready For Field",
          color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-450 dark:bg-emerald-500/[0.05]"
        };
      }
    case 'review':
      return {
        title: "Review Project Deliverables",
        description: "Examine project deliverables, provide feedback, and coordinate field validation.",
        badge: "Review Required",
        color: "text-orange-600 bg-orange-500/10 border-orange-500/20 dark:text-orange-450 dark:bg-orange-500/[0.05]"
      };
    case 'field_assigned':
    case 'field_work':
      return {
        title: "Field Surveying & GPS Mapping",
        description: "Field Engineers are gathering site benchmark points and GPS survey data.",
        badge: "Survey In Progress",
        color: "text-sky-600 bg-sky-500/10 border-sky-500/20 dark:text-sky-450 dark:bg-sky-500/[0.05]"
      };
      case 'data_sync':
        const hasFinalDoc = activityLogs?.some((l: any) => l.action === "FILE_UPLOADED" && l.details?.category === "final_file");
        if (hasFinalDoc) {
          return {
            title: "Engineer Final Review",
            description: "Lead Engineer to approve final deliverable.",
            badge: "Engineer Review Required",
            color: "text-purple-600 bg-purple-500/10 border-purple-500/20 dark:text-purple-450 dark:bg-purple-500/[0.05]"
          };
        }
        return {
          title: "Validate Survey Data & Finalize Deliverables",
          description: "Compare field data and produce final deliverable package.",
          badge: "In Progress",
          color: "text-cyan-600 bg-cyan-500/10 border-cyan-500/20 dark:text-cyan-450 dark:bg-cyan-500/[0.05]"
        };
    case 'qc_review':
      return {
        title: "Engineer Final Review",
        description: "Lead Engineer is reviewing final package for approval or rejection.",
        badge: "Under Review",
        color: "text-purple-600 bg-purple-500/10 border-purple-500/20 dark:text-purple-450 dark:bg-purple-500/[0.05]"
      };
    case 'qc_approved':
      return {
        title: "Finalize & Deliver Project",
        description: "Billing validation, payment confirmation, and dispatching finalized files to client.",
        badge: "Ready For Delivery",
        color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-450 dark:bg-emerald-500/[0.05]"
      };
    default:
      return null;
  }
};

interface ProjectDetailPageProps {
  params: {
    id: string;
  };
}

async function ProjectContentWrapper({ project, profile, user, role, theme, params }: any) {
  const supabase: any = await createClient();
  const adminSupabase: any = createAdminClient();

  const [
    historyRes,
    commentsRes,
    filesRes,
    assignmentsRes,
    milestonesRes,
    activityLogsRes,
    materialsRes
  ] = await Promise.all([
    adminSupabase
      .from('workflow_history')
      .select('id, project_id, from_stage, to_stage, changed_by, comment, created_at')
      .eq('project_id', params.id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('comments')
      .select('id, project_id, user_id, content, comment_type, parent_comment_id, created_at, deleted_at')
      .eq('project_id', params.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('files')
      .select('id, project_id, file_name, file_url, category, mime_type, file_size_bytes, uploaded_by, uploaded_at, deleted_at')
      .eq('project_id', params.id)
      .is('deleted_at', null)
      .order('uploaded_at', { ascending: false })
      .limit(100),
    // User client + RLS — avoid service-role bypass for assignments
    supabase
      .from('project_assignments')
      .select('id, project_id, user_id, role, assigned_at, assigned_by')
      .eq('project_id', params.id),
    getMilestonesAction(params.id),
    adminSupabase
      .from('activity_logs')
      .select('id, project_id, user_id, action, details, created_at')
      .eq('project_id', params.id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('material_requests')
      .select('id, item_name, quantity, status, notes, assigned_to, assigned_by, submitted_at, submitted_by, responsible_person, responsible_person_name, lost_reason, lost_reported_at, resolution_status, created_at')
      .eq('project_id', params.id)
      .order('created_at', { ascending: false }),
  ]);

  const files = filesRes.data || [];
  if (filesRes.error) console.error("Files Fetch Error:", filesRes.error);
  const milestones = milestonesRes.data || [];

  const rawHistory = historyRes.data || [];
  const rawComments = commentsRes.data || [];
  const rawAssignments = assignmentsRes.data || [];
  const rawActivityLogs = activityLogsRes.data || [];
  const rawMaterials = materialsRes.data || [];
  
  if (assignmentsRes.error) console.error("Assignments Fetch Error:", assignmentsRes.error);

  // Collect unique user IDs from all related records (for activity/comment names)
  const uniqueUserIds = new Set<string>();
  rawHistory.forEach((h: any) => h.changed_by && uniqueUserIds.add(h.changed_by));
  rawComments.forEach((c: any) => c.user_id && uniqueUserIds.add(c.user_id));
  rawAssignments.forEach((a: any) => a.user_id && uniqueUserIds.add(a.user_id));
  rawActivityLogs.forEach((l: any) => l.user_id && uniqueUserIds.add(l.user_id));
  rawMaterials.forEach((m: any) => {
    if (m.assigned_to) uniqueUserIds.add(m.assigned_to);
    if (m.assigned_by) uniqueUserIds.add(m.assigned_by);
    if (m.responsible_person) uniqueUserIds.add(m.responsible_person);
  });

  // Full staff directory for team assignment (must not be limited to people already on the project)
  // + referenced profiles for activity names
  const [{ data: staffDirectory }, { data: mentionedProfiles }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, first_name, last_name, email, role, designation, is_active')
      .eq('is_active', true)
      .in('role', ['admin', 'engineer', 'field'])
      .order('first_name'),
    uniqueUserIds.size > 0
      ? supabase
          .from('profiles')
          .select('id, first_name, last_name, email, role, designation')
          .in('id', Array.from(uniqueUserIds))
      : Promise.resolve({ data: [] as any[] }),
  ]);

  // allUsers = assignable staff for Project Team / Ops pickers
  const allUsers: any[] = staffDirectory || [];

  // Build a Map for fast lookup (staff + anyone mentioned in activity)
  const userMap = new Map<string, any>();
  allUsers.forEach((u: any) => userMap.set(u.id, u));
  (mentionedProfiles || []).forEach((u: any) => {
    if (!userMap.has(u.id)) userMap.set(u.id, u);
  });

  // Helper to attach profiles in JavaScript using the Map
  const attachProfile = (data: any[], key: string, profileAlias: string) => {
    return data.map((item: any) => {
      return { ...item, [profileAlias]: userMap.get(item[key]) || null };
    });
  };

  const history = attachProfile(rawHistory, 'changed_by', 'changed_by_profile');
  const comments = attachProfile(rawComments, 'user_id', 'author_profile');
  const assignments = attachProfile(rawAssignments, 'user_id', 'profiles');
  
  const mappedActivityLogs = attachProfile(rawActivityLogs, 'user_id', 'actor_profile');
  const activityLogs = filterActivityLogsByRole(mappedActivityLogs, profile?.role || 'user');

  const initialMaterials = rawMaterials.map((m: any) => {
    const assignedProfile = m.assigned_to ? userMap.get(m.assigned_to) : null;
    const assignerProfile = m.assigned_by ? userMap.get(m.assigned_by) : null;
    const respProfile = m.responsible_person ? userMap.get(m.responsible_person) : null;

    return {
      id: m.id,
      item: m.item_name,
      quantity: m.quantity,
      status: m.status,
      notes: m.notes,
      assigned_to: m.assigned_to,
      assigned_to_name: assignedProfile ? `${assignedProfile.first_name || ''} ${assignedProfile.last_name || ''}`.trim() : null,
      assigned_by_name: assignerProfile ? `${assignerProfile.first_name || ''} ${assignerProfile.last_name || ''}`.trim() : null,
      submitted_at: m.submitted_at,
      responsible_person_id: m.responsible_person,
      responsible_person_name: m.responsible_person_name || (respProfile ? `${respProfile.first_name || ''} ${respProfile.last_name || ''}`.trim() : null),
      lost_reason: m.lost_reason,
      lost_reported_at: m.lost_reported_at,
      resolution_status: m.resolution_status || "unresolved",
      created_at: m.created_at
    };
  });

  const isStageBlocked = (milestones || []).some(
    (m: any) => m.status !== 'paid' && (m.linked_stage === project.status || m.block_after_stage === project.status)
  );
  const isOperationsFrozen = project.is_frozen || isStageBlocked;

  // Fetch operational data from local DB for technical roles
  const isOperationalRole = ['admin', 'engineer', 'field', 'cad'].includes(profile?.role || '');
  const [cadResult, fieldResult] = isOperationalRole
    ? await Promise.all([
        getCADRevisionsAction(params.id),
        getFieldReportsAction(params.id),
      ])
    : [{ data: [] }, { data: [] }];

  const cadRevisions = cadResult.data || [];
  const fieldReports = fieldResult.data || [];

  const teamMembers = (assignments || []).map((a: any) => ({
    userId: a.user_id,
    firstName: a.profiles?.first_name,
    lastName: a.profiles?.last_name,
    email: a.profiles?.email,
    role: a.profiles?.role || a.role
  }));

  return (
    <>
      {/* STAGE DEPENDENT DYNAMIC LOCK BANNER */}
      <StageDependentLockBanner 
        projectId={project.id}
        isFrozen={project.is_frozen}
        freezeReason={project.freeze_reason}
        frozenAt={project.frozen_at}
        milestones={milestones}
        currentStage={project.status}
        dispatchOverrideRequested={project.dispatch_override_requested}
        dispatchOverrideApproved={project.dispatch_override_approved}
      />

      {/* Central Clean Tab-based Layout */}
      <div className="w-full space-y-8 animate-in fade-in duration-700 mt-5">
        {project.is_frozen ? (
          <div className="h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-red-200 dark:border-red-500/20 rounded-3xl bg-red-50/50 dark:bg-red-500/5 mt-10">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-500/20 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <Lock className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Project Access Locked</h2>
            <p className="text-sm font-medium text-slate-500 text-center max-w-md">
              All tabs, files, tasks, and communications are restricted while this project is frozen.
            </p>
          </div>
        ) : (
          <ProjectDetailTabs
            project={project}
            userRole={role}
            currentUserId={user.id}
            history={history}
            activityLogs={activityLogs}
            comments={comments}
            files={files}
            cadRevisions={cadRevisions}
            teamMembers={teamMembers}
            milestones={milestones}
            allUsers={allUsers}
            fieldReports={fieldReports}
            initialMaterials={initialMaterials}
            theme={theme}
            serverRenderTime={Date.now()}
          />
        )}
      </div>
    </>
  );
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const supabase: any = await createClient();

  if (params.id === 'PRJ-PRINT-DESK') {
    redirect('/prints');
  }

  // 1. Fetch Core Project Data
  const { data: project } = await supabase.from('projects').select('*').eq('id', params.id).is('deleted_at', null).single() as { data: any };

  if (!project) return notFound();

  // 2. Fetch Supporting Data
  const profile = await getUserProfileAction();
  if (!profile) return notFound();
  const user = { id: profile.id, email: profile.email };

  const role = profile?.role || "admin";
  const theme = ROLE_THEME[role] || ROLE_THEME.admin;
  const backLink = ROLE_REDIRECTS[role] || "/projects";

  // Layer 1 Security: Application-level check
  const accessCheck = await verifyProjectAccess(params.id, user.id, role as any, true);
  if (!accessCheck.isAllowed) {
    redirect('/unauthorized');
  }

  if (role === 'sales') {
    const isLead = ['lead_created', 'requirement_gathering', 'follow_up_pending'].includes(project.status);
    if (!isLead) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
          <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center">
            <Lock className="w-8 h-8" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Access Restricted</h2>
            <p className="text-slate-500 max-w-sm">This project has been pushed to accounts. You no longer have access to its details.</p>
          </div>
          <Link href="/sales" className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-all shadow-sm">
            Return to Dashboard
          </Link>
        </div>
      );
    }
  }

  const canArchive = profile?.role === 'admin' || profile?.role === 'accountant';
  const isSalesAndHandedOver = role === 'sales' && project.status !== 'lead_created';

  const statusColors: Record<string, string> = {
    lead_created: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
    payment_pending: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    payment_done: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    project_created: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20",
    data_collection: "text-violet-500 bg-violet-500/10 border-violet-500/20",
    prototype: "text-purple-500 bg-purple-500/10 border-purple-500/20",
    review: "text-orange-500 bg-orange-500/10 border-orange-500/20",
    field_work: "text-sky-500 bg-sky-500/10 border-sky-500/20",
    completed: "text-emerald-600 bg-indigo-600/10 border-emerald-600/20",
    archived: "text-slate-500 bg-slate-500/10 border-slate-500/20",
  };

  const displayStatus = isSalesAndHandedOver
    ? "Submitted to Accounts / Operational Execution"
    : project.status.replace("_", " ");

  const displayStatusColor = isSalesAndHandedOver
    ? "text-indigo-500 bg-indigo-500/10 border-indigo-500/20"
    : (statusColors[project.status] || "text-gray-500 bg-gray-500/10 border-gray-500/20");

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      {/* Unified Page Header */}
      <div className="relative overflow-hidden">
        <div className="relative z-10">
          {/* Breadcrumb row */}
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            <Link href={backLink} className={cn("group flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors", theme.hover)}>
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              Directory
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-700" />
            <span className={cn("text-sm nums font-medium flex items-center gap-1", theme.text)}>
              <Hash className="w-3.5 h-3.5" />{project.id}
            </span>
          </div>

          {/* Title + Actions row */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200/60 dark:border-white/5 pb-6">
            
            {/* Left Side: Title */}
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                {project.name}
              </h1>
            </div>

            {/* Right Side: Meta Info & Actions */}
            <div className="flex flex-col lg:items-end gap-3 shrink-0">
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                <span>
                  {project.client_name || "Direct Client"}
                </span>
                {(() => {
                  const contactText = project.client_contact || '';
                  const phoneMatch = contactText.match(/Phone:\s*([^,]*)/i);
                  const phoneVal = phoneMatch ? phoneMatch[1].trim() : '';
                  const canSeePhone = ['admin', 'sales', 'accountant', 'engineer'].includes(role || '');

                  if (phoneVal && canSeePhone) {
                    return (
                      <>
                        <span className="text-slate-300 dark:text-slate-700">·</span>
                        <span className="flex items-center gap-1.5 font-medium" title="Client Phone">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          {maskPhone(phoneVal)}
                        </span>
                      </>
                    );
                  }
                  return null;
                })()}
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(project.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <span className={cn(
                  "px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-widest border",
                  displayStatusColor
                )}>
                  {displayStatus}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5">
                {(role === 'admin' || role === 'accountant') && (
                  <ProjectDeleteButton projectId={project.id} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Suspense fallback={
        <div className="flex flex-col items-center justify-center h-64 space-y-4 mt-10">
          <div className="w-10 h-10 rounded-full border-[3px] border-indigo-500 border-t-transparent animate-spin" />
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Loading Project Modules...</p>
        </div>
      }>
        <ProjectContentWrapper project={project} profile={profile} user={user} role={role} theme={theme} params={params} />
      </Suspense>
    </div>
  );
}

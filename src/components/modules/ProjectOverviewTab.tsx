'use client';

import React, { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  User, 
  MapPin, 
  Calendar, 
  Edit3, 
  Briefcase,
  Loader2,
  Phone,
  Mail,
  Printer,
  Building2,
  Clock
} from 'lucide-react';
import { updateProjectAction } from '@/actions/project.actions';
import { assignUserToProjectAction, removeUserFromProjectAction } from '@/actions/assignment.actions';
import { useToast } from '@/hooks/use-toast';
import { maskEmail, maskPhone } from '@/lib/utils';
import { OperationsFileUploadPanel } from './OperationsFileUploadPanel';
import { CADRevisionPanel } from './CADRevisionPanel';
import { ProjectTeamSection } from './ProjectTeamSection';
import { ProjectMaterialsSection } from './ProjectMaterialsSection';
import { OperationsControlCenter } from './OperationsControlCenter';


const SITE_TYPE_LABELS: Record<string, string> = {
  residential: 'Residential',
  commercial: 'Commercial',
  industrial: 'Industrial',
  infrastructure: 'Infrastructure',
  government: 'Government',
  semi_government: 'Semi-Government',
  'semi-government': 'Semi-Government',
  agricultural: 'Agricultural',
  other: 'Other',
};

function formatDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const datePart = dateStr.split('T')[0];
  const parts = datePart.split('-');
  if (parts.length === 3) {
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    }
  }
  const fallback = new Date(dateStr);
  return isNaN(fallback.getTime()) ? dateStr : fallback.toLocaleDateString();
}

interface ProjectOverviewTabProps {
  project: any;
  userRole: string;
  currentUserId: string;
  teamMembers: any[];
  allUsers: any[];
  files: any[];
  cadRevisions?: any[];
  activityLogs?: any[];
  comments?: any[];
  initialMaterials?: any[];
  onUpdateProject?: (updatedProject: any) => void;
  onUpdateTeamMembers?: (updatedTeamMembers: any[]) => void;
  onUpdateFiles?: (files: any[]) => void;
}

export default function ProjectOverviewTab({
  project,
  userRole,
  currentUserId,
  teamMembers,
  allUsers,
  files,
  cadRevisions = [],
  activityLogs = [],
  comments = [],
  initialMaterials = [],
  onUpdateProject,
  onUpdateTeamMembers,
  onUpdateFiles
}: ProjectOverviewTabProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);

  // Parse contact person and details from client_contact
  const contactText = project.client_contact || '';
  const phoneMatch = contactText.match(/Phone:\s*([^,]*)/i);
  const emailMatch = contactText.match(/Email:\s*(.*)/i);
  const phoneVal = phoneMatch ? phoneMatch[1].trim() : '';
  const emailVal = emailMatch ? emailMatch[1].trim() : '';

  // Form states
  const [name, setName] = useState(project.name || '');
  const [clientName, setClientName] = useState(project.client_name || '');
  const [clientAddress, setClientAddress] = useState(project.client_address || '');
  const [contactPhone, setContactPhone] = useState(phoneVal);
  const [contactEmail, setContactEmail] = useState(emailVal);
  const normalizedSiteType = project.site_type === 'semi-government' ? 'semi_government' : (project.site_type || 'residential');
  const [siteType, setSiteType] = useState(normalizedSiteType);
  const [siteCoordinates, setSiteCoordinates] = useState(project.site_coordinates || '');
  const [surveyRequirements, setSurveyRequirements] = useState(project.survey_requirements || '');
  const [targetCompletionDate, setTargetCompletionDate] = useState(project.target_completion_date ? project.target_completion_date.split('T')[0] : '');

  useEffect(() => {
    setName(project.name || '');
    setClientName(project.client_name || '');
    setClientAddress(project.client_address || '');
    setContactPhone(phoneVal);
    setContactEmail(emailVal);
    setSiteType(project.site_type === 'semi-government' ? 'semi_government' : (project.site_type || 'residential'));
    setSiteCoordinates(project.site_coordinates || '');
    setSurveyRequirements(project.survey_requirements || '');
    setTargetCompletionDate(project.target_completion_date ? project.target_completion_date.split('T')[0] : '');
  }, [project, phoneVal, emailVal]);

  // Role permissions checks
  const isAdmin = userRole === 'admin';
  const isAccountant = userRole === 'accountant';
  const isEngineer = userRole === 'engineer';
  const isSales = userRole === 'sales';
  const isField = userRole?.toLowerCase() === 'field';

  const isSalesAndHandedOver = project.status !== 'lead_created';
  
  const isClaimedByMe = teamMembers.some((m: any) => m.userId === currentUserId);
  const needsClaiming = isEngineer && !isClaimedByMe && !isAdmin;

  const isProjectClosed = project.status === 'completed' || project.status === 'archived';
  const canEditAll = (isAdmin || isAccountant || isSales) && !isProjectClosed;
  const canEditPartial = false; // Engineers no longer have edit access
  const canEditAny = canEditAll || canEditPartial;

  // Assignment states & actions
  const [selectedField, setSelectedField] = useState('');
  const [selectedEngineer, setSelectedEngineer] = useState('');

  // Group users by role
  const fieldUsers = allUsers.filter((u: any) => u.role === 'field');
  const engineerUsers = allUsers.filter((u: any) => u.role === 'engineer');

  const assignedEngineer = teamMembers.find((m: any) => m.role === 'engineer');
  const assignedFields = teamMembers.filter((m: any) => m.role === 'field');

  const handleSave = () => {
    startTransition(async () => {
      // Reconstruct client_contact
      const client_contact = `Phone: ${contactPhone}, Email: ${contactEmail}`;
      const payload: any = {};

      if (canEditAll) {
        payload.name = name;
        payload.client_name = clientName;
        payload.client_address = clientAddress;
        payload.client_contact = client_contact;
        payload.site_type = siteType;
      }
      
      // Both accountant/admin and engineer can edit coordinates, summary, and target date
      payload.site_coordinates = siteCoordinates;
      payload.survey_requirements = surveyRequirements;
      payload.target_completion_date = targetCompletionDate || null;

      const res = await updateProjectAction(project.id, payload);
      if (res?.success) {
        toast({ title: 'Overview Updated', description: 'Project details updated successfully.', variant: 'success' });
        setIsEditing(false);
        if (onUpdateProject) {
          onUpdateProject(res.data || payload);
        }
      } else {
        toast({ title: 'Update Failed', description: res?.error || 'An error occurred.', variant: 'error' });
      }
    });
  };

  const handleAssign = (userId: string, role: string) => {
    if (!userId) return;
    startTransition(async () => {
      const res = await assignUserToProjectAction(project.id, userId, role);
      if (res?.success) {
        toast({ title: 'Member Assigned', description: `User assigned as ${role.toUpperCase()} successfully.`, variant: 'success' });
        if (role === 'field') setSelectedField('');
        if (role === 'engineer') setSelectedEngineer('');
        if (onUpdateTeamMembers && res.data) {
          onUpdateTeamMembers([...teamMembers, res.data]);
        }
      } else {
        toast({ title: 'Assignment Failed', description: res?.error || 'An error occurred.', variant: 'error' });
      }
    });
  };

  const handleRemoveAssignment = (userId: string) => {
    startTransition(async () => {
      const res = await removeUserFromProjectAction(userId, project.id);
      if (res?.success) {
        toast({ title: 'Assignment Removed', description: 'User has been unassigned.', variant: 'success' });
        if (onUpdateTeamMembers) {
          onUpdateTeamMembers(teamMembers.filter(m => m.user_id !== userId));
        }
      } else {
        toast({ title: 'Removal Failed', description: res?.error || 'An error occurred.', variant: 'error' });
      }
    });
  };

  const hasAccessToOps = isAdmin || isClaimedByMe || ((isEngineer || isField) && !isProjectClosed);

  return (
    <div className="space-y-8 pb-10">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        
        {/* LEFT COLUMN: Project Details & Team (40%) */}
        <div className="lg:col-span-2 space-y-8">
        
        {/* Project Details Block */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-indigo-500" />
              Project Details
            </h3>
            <div className="flex gap-2 items-center">
              <button 
                onClick={() => {
                  const latestFile = (files || []).filter((f: any) => f.category === 'final_file' || f.category === 'prototype' || f.category === 'raw_data').sort((a: any, b: any) => new Date(b.uploaded_at || b.created_at).getTime() - new Date(a.uploaded_at || a.created_at).getTime())[0];
                  router.push(`/prints?projectId=${project.id}&clientName=${encodeURIComponent(project.client_name || '')}&fileName=${encodeURIComponent(latestFile?.file_name || '')}`);
                }}
                className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-xs font-semibold transition flex items-center gap-1.5"
                title="Send drawing or document to Print Desk"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Desk
              </button>
              {canEditAny && !isEditing && (
                <button 
                  onClick={() => setIsEditing(true)}
                  className="w-9 h-9 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10 transition"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {isEditing && (
            <div className="mb-6 p-6 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-2xl">
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Project Name</label>
                    <input type="text" disabled={!canEditAll} value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl text-sm font-medium text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Client Name</label>
                    <input type="text" disabled={!canEditAll} value={clientName} onChange={(e) => setClientName(e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl text-sm font-medium text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Contact Phone</label>
                    <input type="text" disabled={!canEditAll} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl text-sm font-medium text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Contact Email</label>
                    <input type="text" disabled={!canEditAll} value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl text-sm font-medium text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Client Address</label>
                  <input type="text" disabled={!canEditAll} value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl text-sm font-medium text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Site Type</label>
                    <select disabled={!canEditAll} value={siteType} onChange={(e) => setSiteType(e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl text-sm font-medium text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500">
                      <option value="residential">Residential</option>
                      <option value="commercial">Commercial</option>
                      <option value="industrial">Industrial</option>
                      <option value="infrastructure">Infrastructure</option>
                      <option value="government">Government</option>
                      <option value="semi_government">Semi-Government</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Target Completion Date</label>
                    <input type="date" value={targetCompletionDate} onChange={(e) => setTargetCompletionDate(e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl text-sm font-medium text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Project Summary</label>
                  <textarea rows={4} value={surveyRequirements} onChange={(e) => setSurveyRequirements(e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl text-sm font-medium text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500 resize-none" />
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <button onClick={() => setIsEditing(false)} className="px-5 py-2.5 rounded-2xl text-slate-500 hover:bg-slate-100 text-sm font-semibold transition">Cancel</button>
                  <button onClick={handleSave} disabled={isPending} className="px-5 py-2.5 rounded-2xl bg-[#a4bcf8] hover:bg-[#8eaaf0] text-white font-semibold text-sm flex items-center gap-2 transition">
                    {isPending && <Loader2 className="w-4 h-4 animate-spin" />} Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-5">
            <div className="flex items-center justify-between group">
              <div className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 shrink-0">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-400 mb-0.5">Project Name</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{project.name}</p>
                </div>
              </div>
            </div>

            {project.client_name && (
              <div className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-400 mb-0.5">Client Name</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{project.client_name}</p>
                </div>
              </div>
            )}

            {emailVal && (
              <div className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-400 mb-0.5">Email</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{maskEmail(emailVal)}</p>
                </div>
              </div>
            )}

            {phoneVal && (
              <div className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 shrink-0">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-400 mb-0.5">Phone</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{maskPhone(phoneVal)}</p>
                </div>
              </div>
            )}

            {project.client_address && (
              <div className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 shrink-0">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-400 mb-0.5">Address</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{project.client_address}</p>
                </div>
              </div>
            )}

            {project.site_type && (
              <div className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-400 mb-0.5">Site Type</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {SITE_TYPE_LABELS[project.site_type?.toLowerCase()] || project.site_type}
                  </p>
                </div>
              </div>
            )}

            {project.target_completion_date && (
              <div className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-400 mb-0.5">Target Completion Date</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {formatDisplayDate(project.target_completion_date)}
                  </p>
                </div>
              </div>
            )}

            {project.created_at && (
              <div className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-400 mb-0.5">Started At</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {new Date(project.created_at).toLocaleDateString()} at {new Date(project.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </p>
                </div>
              </div>
            )}
          </div>

          {project.survey_requirements && (
            <div className="mt-6 p-5 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Project Overview</h4>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {project.survey_requirements}
              </p>
            </div>
          )}
        </div>

        {/* Project Team */}
        <ProjectTeamSection 
          projectId={project.id}
          assignments={teamMembers || []}
          staff={allUsers || []}
          canAssign={(isAdmin || isEngineer) && !isProjectClosed}
          onUpdateTeamMembers={onUpdateTeamMembers}
        />

      </div>

      {/* RIGHT COLUMN: Operations (60%) */}
      <div className="lg:col-span-3 space-y-8">
        {hasAccessToOps && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            

            {(isAdmin || isClaimedByMe || needsClaiming) && (
              <OperationsControlCenter
                projectId={project.id}
                projectStatus={project.status}
                userRole={userRole}
                currentUserId={currentUserId}
                teamMembers={teamMembers}
                isFrozen={project.is_frozen}
                files={files || []}
              />
            )}

            {(isAdmin || isClaimedByMe) && (
              <>
                <OperationsFileUploadPanel
                  projectId={project.id}
                  files={files || []}
                  userRole={userRole}
                  projectStatus={project.status}
                  teamMembers={teamMembers}
                  cadRevisions={cadRevisions}
                  activityLogs={activityLogs}
                  comments={comments}
                  onUpdateFiles={onUpdateFiles}
                  onUpdateProject={onUpdateProject}
                />

                {(isAdmin || isEngineer || isClaimedByMe) && (
                  <CADRevisionPanel
                    projectId={project.id}
                    revisions={cadRevisions}
                    userRole={userRole}
                    currentUserId={currentUserId}
                    isFrozen={project.is_frozen}
                    bypassActive={project.bypass_active}
                  />
                )}
              </>
            )}

          </div>
        )}
      </div>

      </div>

      {/* Material Assignment - Full Width */}
      {!isField && (
        <ProjectMaterialsSection 
          projectId={project.id}
          assignments={teamMembers || []}
          staff={allUsers || []}
          canAssign={(isAdmin || isEngineer) && !isProjectClosed}
          initialMaterials={initialMaterials}
        />
      )}

    </div>
  );
}

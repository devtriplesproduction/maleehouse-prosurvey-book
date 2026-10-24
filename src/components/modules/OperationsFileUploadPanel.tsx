'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Loader2,
  FolderOpen,
  Send,
  Plus,
  Download,
  Eye,
  BookOpen,
  PenTool,
  Trash2,
  Bell,
  MapPin,
  CheckCircle2,
  XCircle,
  ChevronUp,
  ChevronDown,
  Package,
  AlertTriangle,
  PackageX
} from 'lucide-react';
import { downloadFile } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { getProjectMaterialsAction, submitAllProjectMaterialsAction } from '@/actions/field.actions';
import { SubmitMaterialsModal } from '@/components/modules/SubmitMaterialsModal';
import { uploadProjectFile } from '@/lib/supabase/storage';
import { updateProjectStageAction } from '@/actions/workflow.actions';
import { reviewFieldSurveyAction } from '@/actions/operations.actions';
import { registerFileAction } from '@/actions/file.actions';
import { deleteFileAction } from '@/actions/vault.actions';
import { notifySupplementalUploadAction } from '@/actions/notification.actions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ActiveReworkBanner } from './ActiveReworkBanner';
import { detectActiveRework } from '@/lib/rework-utils';

function CollapsibleWidget({ title, icon: Icon, defaultExpanded = true, children, rightAction, badgeCount }: any) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  return (
    <div className="glass-card border border-slate-200 dark:border-white/10 rounded-3xl overflow-hidden shadow-sm transition-all bg-white dark:bg-slate-900">
      <div
        className="flex items-center justify-between p-5 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 rounded-xl">
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white tracking-tight">{title}</h3>
            {badgeCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-black tracking-wider">
                {badgeCount} {badgeCount === 1 ? 'FILE' : 'FILES'}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
          {rightAction}
          <button
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-200 dark:hover:bg-white/10 transition-colors text-slate-400"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>
      {isExpanded && (
        <div className="px-5 pb-6 animate-in slide-in-from-top-2 duration-300">
          <div className="h-px w-full bg-slate-100 dark:bg-white/5 mb-5" />
          {children}
        </div>
      )}
    </div>
  );
}

interface OperationsFileUploadPanelProps {
  projectId: string;
  files: any[];
  userRole: string;
  projectStatus?: string;
  teamMembers?: any[];
  cadRevisions?: any[];
  activityLogs?: any[];
  comments?: any[];
  onUpdateFiles?: (files: any[]) => void;
  onUpdateProject?: (updatedProject: any) => void;
}

export function OperationsFileUploadPanel({
  projectId,
  files,
  userRole,
  projectStatus,
  teamMembers = [],
  cadRevisions = [],
  activityLogs = [],
  comments = [],
  onUpdateFiles,
  onUpdateProject
}: OperationsFileUploadPanelProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const activeRework = React.useMemo(() => {
    return detectActiveRework(projectStatus || '', activityLogs, comments);
  }, [projectStatus, activityLogs, comments]);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [rejectionModal, setRejectionModal] = useState<{ isOpen: boolean, type: 'survey' | 'final' | null }>({ isOpen: false, type: null });
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionComments, setRejectionComments] = useState('');
  const [rejectionInstructions, setRejectionInstructions] = useState('');

  const isAdmin = userRole === 'admin';
  const isEngineer = userRole === 'engineer';
  const isField = userRole === 'field';

  const isProjectClosed = projectStatus === 'completed' || projectStatus === 'archived';
  const isMidstage = projectStatus && projectStatus !== 'project_created';

  const [submittedSections, setSubmittedSections] = useState<Record<string, number>>({});
  const [sessionUploadedDocIds, setSessionUploadedDocIds] = useState<Set<string>>(new Set());

  const hasFieldTeam = (teamMembers || []).some(
    (m: any) => m.role === 'field' || m.role === 'lidar_specialist' || m.profiles?.role === 'field' || m.profiles?.role === 'lidar_specialist'
  );

  const clientDocs = files.filter((f: any) => f.category === 'requirements' || f.category === 'intake_document');
  const controlPointDocs = files.filter((f: any) => f.category === 'control_point_image');
  const surveyDocs = files.filter((f: any) => f.category === 'survey_data' || f.category === 'control_point_csv');
  const finalDocs = files.filter((f: any) => f.category === 'final_file');

  const sortedClientDocs = [...clientDocs].sort((a: any, b: any) => {
    const timeA = new Date(a.uploaded_at || a.created_at || 0).getTime();
    const timeB = new Date(b.uploaded_at || b.created_at || 0).getTime();
    return timeB - timeA;
  });
  const latestClientDoc = sortedClientDocs[0];
  const latestClientDocTime = latestClientDoc ? new Date(latestClientDoc.uploaded_at || latestClientDoc.created_at || 0).getTime() : 0;

  const hasNewClientDocUpload = (() => {
    if (clientDocs.length === 0) return false;
    if (submittedSections.client && submittedSections.client >= latestClientDocTime) {
      return false;
    }
    if (clientDocs.some((f: any) => sessionUploadedDocIds.has(f.id))) {
      return true;
    }
    if (!isMidstage) {
      return !submittedSections.client;
    }
    const lastClientSubmitTime = (activityLogs || []).reduce((max: number, l: any) => {
      if (
        l.action === 'SUPPLEMENTAL_UPLOAD_NOTIFIED' ||
        l.action === 'DISPATCHED_TO_FIELD' ||
        l.stage === 'field_assigned' ||
        (l.action === 'STAGE_TRANSITION' && l.details?.to_stage === 'field_assigned')
      ) {
        const t = new Date(l.created_at || 0).getTime();
        return t > max ? t : max;
      }
      return max;
    }, 0);
    if (lastClientSubmitTime > 0) {
      return latestClientDocTime > lastClientSubmitTime;
    }
    return false;
  })();

  const allSurveyFiles = [...surveyDocs, ...controlPointDocs];
  const sortedSurveyFiles = [...allSurveyFiles].sort((a: any, b: any) => {
    const timeA = new Date(a.uploaded_at || a.created_at || 0).getTime();
    const timeB = new Date(b.uploaded_at || b.created_at || 0).getTime();
    return timeB - timeA;
  });
  const latestSurveyFile = sortedSurveyFiles[0];
  const latestSurveyFileTime = latestSurveyFile ? new Date(latestSurveyFile.uploaded_at || latestSurveyFile.created_at || 0).getTime() : 0;

  const hasNewSurveyUpload = (() => {
    if (surveyDocs.length === 0 || controlPointDocs.length === 0) return false;
    if (submittedSections.survey && submittedSections.survey >= latestSurveyFileTime) {
      return false;
    }
    if (allSurveyFiles.some((f: any) => sessionUploadedDocIds.has(f.id))) {
      return true;
    }
    if (projectStatus === 'data_collection' || projectStatus === 'project_created') {
      return !submittedSections.survey;
    }
    const lastSurveySubmitTime = (activityLogs || []).reduce((max: number, l: any) => {
      if (
        l.stage === 'data_sync' ||
        (l.action === 'STAGE_TRANSITION' && l.details?.to_stage === 'data_sync') ||
        l.action === 'SURVEY_DATA_SUBMITTED' ||
        l.action === 'FIELD_SURVEY_APPROVED' ||
        l.action === 'FIELD_SURVEY_REJECTED'
      ) {
        const t = new Date(l.created_at || 0).getTime();
        return t > max ? t : max;
      }
      return max;
    }, 0);
    if (lastSurveySubmitTime > 0) {
      return latestSurveyFileTime > lastSurveySubmitTime;
    }
    return false;
  })();

  const sortedRevisions = [...(cadRevisions || [])].sort((a: any, b: any) => {
    const timeA = new Date(a.submitted_at || a.created_at || 0).getTime();
    const timeB = new Date(b.submitted_at || b.created_at || 0).getTime();
    return timeB - timeA;
  });
  const latestCADRevision = sortedRevisions[0];
  const sortedFinals = [...finalDocs].sort((a: any, b: any) => {
    const timeA = new Date(a.uploaded_at || a.created_at || 0).getTime();
    const timeB = new Date(b.uploaded_at || b.created_at || 0).getTime();
    return timeB - timeA;
  });
  const latestFinal = sortedFinals[0];
  const latestFinalRevision = sortedRevisions.find((r: any) => r.revision_type === 'final');

  // Materials & Equipment tracking for final deliverable
  const [projectMaterials, setProjectMaterials] = useState<any[]>([]);
  const [isSubmitMaterialsModalOpen, setIsSubmitMaterialsModalOpen] = useState(false);

  const fetchMaterials = React.useCallback(async () => {
    try {
      const res = await getProjectMaterialsAction(projectId);
      if (res.success && res.data) {
        setProjectMaterials(res.data);
      }
    } catch (e) {
      console.error(e);
    }
  }, [projectId]);

  React.useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  const pendingProjectMaterials = projectMaterials.filter(
    (m: any) => m.status === 'assigned' || m.status === 'requested'
  );
  const lostProjectMaterials = projectMaterials.filter(
    (m: any) => m.status === 'lost' || m.status === 'missing'
  );
  const submittedProjectMaterials = projectMaterials.filter(
    (m: any) => m.status === 'submitted' || m.status === 'returned'
  );

  const hasNewFinalUpload = (() => {
    if (finalDocs.length === 0) return false;
    const finalTime = latestFinal ? new Date(latestFinal.uploaded_at || latestFinal.created_at || 0).getTime() : 0;
    if (submittedSections.final && submittedSections.final >= finalTime) {
      return false;
    }
    if (finalDocs.some((f: any) => sessionUploadedDocIds.has(f.id))) {
      return true;
    }
    if (!latestFinalRevision) return true;
    const revTime = new Date(latestFinalRevision.submitted_at || latestFinalRevision.updated_at || latestFinalRevision.created_at || 0).getTime();
    return finalTime > revTime;
  })();

  const ensureClaimed = async () => {
    try {
      const { claimProjectAction } = await import("@/actions/operations.actions");
      await claimProjectAction(projectId);
    } catch(e) {
      // Ignore if already assigned
    }
  };

  const handleUploadControlPoint = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    await ensureClaimed();

    setIsUploading(true);
    setUploadProgress(10);

    try {
      setUploadProgress(40);
      const uploadResult = await uploadProjectFile(file, projectId);
      setUploadProgress(70);

      const registerResult = await registerFileAction({
        project_id: projectId,
        category: 'control_point_image',
        file_name: uploadResult.fileName,
        file_url: uploadResult.publicUrl,
        mime_type: uploadResult.mimeType,
        file_size: uploadResult.fileSize,
        storage_bucket: 'project-assets',
      });

      if (!registerResult.success) {
        throw new Error(registerResult.error || 'Failed to register file in database');
      }

      setUploadProgress(100);
      toast({
        title: 'Upload Successful',
        description: `"${file.name}" uploaded successfully.`,
        variant: 'success'
      });

      setIsUploading(false);
      setUploadProgress(0);
      onUpdateFiles?.([registerResult.data, ...files]);
      setSessionUploadedDocIds(prev => new Set(prev).add(registerResult.data?.id || uploadResult.fileName));
      setSubmittedSections(prev => { const n = { ...prev }; delete n.survey; return n; });

      if (registerResult.data?.updated_project_stage) {
        onUpdateProject?.({ status: registerResult.data.updated_project_stage });
        toast({
          title: 'Workflow Rewound',
          description: `New control point uploaded. Project moved back to ${registerResult.data.updated_project_stage} to resume work.`,
          variant: 'default'
        });
        router.refresh();
      }

    } catch (err: any) {
      console.error(err);
      setIsUploading(false);
      toast({
        title: 'Upload Failed',
        description: err.message || 'File upload failed.',
        variant: 'error'
      });
    }
  };

  const handleUploadClientDoc = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    await ensureClaimed();

    setIsUploading(true);
    setUploadProgress(10);

    try {
      setUploadProgress(40);
      const uploadResult = await uploadProjectFile(file, projectId);
      setUploadProgress(70);

      const registerResult = await registerFileAction({
        project_id: projectId,
        category: 'requirements',
        file_name: uploadResult.fileName,
        file_url: uploadResult.publicUrl,
        mime_type: uploadResult.mimeType,
        file_size: uploadResult.fileSize,
        storage_bucket: 'project-assets',
      });

      if (!registerResult.success) {
        throw new Error(registerResult.error || 'Failed to register file in database');
      }

      setUploadProgress(100);
      toast({
        title: 'Upload Successful',
        description: `"${file.name}" uploaded to Client Documents.`,
        variant: 'success'
      });

      setIsUploading(false);
      setUploadProgress(0);
      onUpdateFiles?.([registerResult.data, ...files]);
      setSessionUploadedDocIds(prev => new Set(prev).add(registerResult.data?.id || uploadResult.fileName));
      setSubmittedSections(prev => { const n = { ...prev }; delete n.client; return n; });

      if (registerResult.data?.updated_project_stage) {
        onUpdateProject?.({ status: registerResult.data.updated_project_stage });
        toast({
          title: 'Workflow Rewound',
          description: `New client document uploaded. Project moved back to ${registerResult.data.updated_project_stage} to resume work.`,
          variant: 'default'
        });
        router.refresh();
      }

    } catch (err: any) {
      console.error(err);
      setIsUploading(false);
      toast({
        title: 'Upload Failed',
        description: err.message || 'File upload failed.',
        variant: 'error'
      });
    }
  };

  const handleSendToField = () => {
    if (!hasFieldTeam) {
      toast({
        title: 'Field Team Required',
        description: 'Please assign a Field Crew member in the Project Team section before proceeding.',
        variant: 'error'
      });
      return;
    }

    setLoadingAction('send_to_field');
    startTransition(async () => {
      // Auto-claim the project for the engineer if not already assigned
      const { claimProjectAction } = await import("@/actions/operations.actions");
      await claimProjectAction(projectId).catch(() => {});

      const res = await updateProjectStageAction(
        projectId,
        'field_assigned',
        'Client documents uploaded. Dispatched for Field Team assignment and survey collection.'
      );
      if (res?.success) {
        setSubmittedSections(prev => ({ ...prev, client: Date.now() }));
        setSessionUploadedDocIds(prev => {
          const next = new Set(prev);
          clientDocs.forEach((d: any) => next.delete(d.id));
          return next;
        });
        toast({
          title: 'Dispatched to Field',
          description: 'Project moved to Field Team Assignment stage successfully.',
          variant: 'success'
        });
        onUpdateProject?.({ status: 'field_assigned' });
        router.refresh();
      } else {
        toast({
          title: 'Dispatch Failed',
          description: res?.error || 'An error occurred.',
          variant: 'error'
        });
      }
      setLoadingAction(null);
    });
  };

  const handleSendUpdate = () => {
    setLoadingAction('send_update');
    startTransition(async () => {
      const res = await notifySupplementalUploadAction(projectId);
      if (res.success) {
        setSubmittedSections(prev => ({ ...prev, client: Date.now() }));
        setSessionUploadedDocIds(prev => {
          const next = new Set(prev);
          clientDocs.forEach((d: any) => next.delete(d.id));
          return next;
        });
        toast({
          title: 'Update Sent',
          description: 'Notification sent to next stage accounts regarding the new file upload.',
          variant: 'success'
        });
        router.refresh();
      } else {
        toast({
          title: 'Notification Failed',
          description: res.error || 'Failed to send notifications.',
          variant: 'error'
        });
      }
      setLoadingAction(null);
    });
  };


  const handleUploadSurveyData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    await ensureClaimed();

    setIsUploading(true);
    setUploadProgress(10);

    try {
      setUploadProgress(40);
      const uploadResult = await uploadProjectFile(file, projectId);
      setUploadProgress(70);

      const registerResult = await registerFileAction({
        project_id: projectId,
        category: 'survey_data',
        file_name: uploadResult.fileName,
        file_url: uploadResult.publicUrl,
        mime_type: uploadResult.mimeType,
        file_size: uploadResult.fileSize,
        storage_bucket: 'project-assets',
      });

      if (!registerResult.success) {
        throw new Error(registerResult.error || 'Failed to register file in database');
      }

      setUploadProgress(100);
      toast({
        title: 'Upload Successful',
        description: `"${file.name}" uploaded to Survey Data.`,
        variant: 'success'
      });

      setIsUploading(false);
      setUploadProgress(0);
      onUpdateFiles?.([registerResult.data, ...files]);
      setSessionUploadedDocIds(prev => new Set(prev).add(registerResult.data?.id || uploadResult.fileName));
      setSubmittedSections(prev => { const n = { ...prev }; delete n.survey; return n; });

      if (registerResult.data?.updated_project_stage) {
        onUpdateProject?.({ status: registerResult.data.updated_project_stage });
        toast({
          title: 'Workflow Rewound',
          description: `New survey data uploaded. Project moved back to ${registerResult.data.updated_project_stage} to resume work.`,
          variant: 'default'
        });
        router.refresh();
      }

    } catch (err: any) {
      console.error(err);
      setIsUploading(false);
      toast({
        title: 'Upload Failed',
        description: err.message || 'File upload failed.',
        variant: 'error'
      });
    }
  };

  const handleUploadFinalDoc = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    await ensureClaimed();

    setIsUploading(true);
    setUploadProgress(10);

    try {
      setUploadProgress(40);
      const uploadResult = await uploadProjectFile(file, projectId);
      setUploadProgress(70);

      const registerResult = await registerFileAction({
        project_id: projectId,
        category: 'final_file',
        file_name: uploadResult.fileName,
        file_url: uploadResult.publicUrl,
        mime_type: uploadResult.mimeType,
        file_size: uploadResult.fileSize,
        storage_bucket: 'project-assets',
      });

      if (!registerResult.success) {
        throw new Error(registerResult.error || 'Failed to register file in database');
      }

      setUploadProgress(100);
      toast({
        title: 'Upload Successful',
        description: `"${file.name}" uploaded to Final Deliverables.`,
        variant: 'success'
      });

      setIsUploading(false);
      setUploadProgress(0);
      onUpdateFiles?.([registerResult.data, ...files]);
      setSessionUploadedDocIds(prev => new Set(prev).add(registerResult.data?.id || uploadResult.fileName));
      setSubmittedSections(prev => { const n = { ...prev }; delete n.final; return n; });

      if (registerResult.data?.updated_project_stage) {
        onUpdateProject?.({ status: registerResult.data.updated_project_stage });
        toast({
          title: 'Workflow Rewound',
          description: `New deliverable uploaded. Project status moved to ${registerResult.data.updated_project_stage}.`,
          variant: 'default'
        });
        router.refresh();
      }

      router.refresh();
    } catch (err: any) {
      console.error(err);
      setIsUploading(false);
      toast({
        title: 'Upload Failed',
        description: err.message || 'File upload failed.',
        variant: 'error'
      });
    }
  };


  const handleReviewSurveyInline = (isApproved: boolean) => {
    if (isApproved) {
      if (pendingProjectMaterials.length > 0) {
        toast({
          title: "Materials Return / Accounting Required",
          description: `All assigned materials (${pendingProjectMaterials.length} pending) must be submitted to the company or reported missing with responsible members before accepting the survey.`,
          variant: "error"
        });
        return;
      }
      setLoadingAction('approve_survey');
      startTransition(async () => {
        const res = await reviewFieldSurveyAction(projectId, true, "");
        if (res.success) {
          toast({
            title: 'Survey Validated',
            description: 'Project moved to Deliverables stage.',
            variant: 'success'
          });
        } else {
          toast({
            title: 'Action Failed',
            description: res.error || 'Failed to review survey.',
            variant: 'error'
          });
        }
        setLoadingAction(null);
      });
    } else {
      setRejectionReason('');
      setRejectionModal({ isOpen: true, type: 'survey' });
    }
  };

  const handleReviewFinalDeliverableInline = (isApproved: boolean) => {
    if (isApproved) {
      if (!confirm("Are you sure you want to approve this final deliverable and mark the project as delivered?")) return;
      setLoadingAction('approve_final');
      startTransition(async () => {
        const { engineerReviewFinalDeliverableAction } = await import("@/actions/review.actions");
        const res = await engineerReviewFinalDeliverableAction(projectId, true);
        if (res.success) {
          toast({
            title: 'Final Deliverable Approved',
            description: 'Project marked as Delivered.',
            variant: 'success'
          });
          onUpdateProject?.({ status: 'completed' });
          router.refresh();
        } else {
          toast({
            title: 'Approval Failed',
            description: res.error || 'An error occurred.',
            variant: 'error'
          });
        }
        setLoadingAction(null);
      });
    } else {
      setRejectionReason('');
      setRejectionComments('');
      setRejectionInstructions('');
      setRejectionModal({ isOpen: true, type: 'final' });
    }
  };

  const submitRejection = () => {
    if (!rejectionReason.trim()) {
      toast({ title: 'Validation', description: 'Rejection reason is required.', variant: 'error' });
      return;
    }

    setLoadingAction('submit_rejection');
    startTransition(async () => {
      if (rejectionModal.type === 'survey') {
        const res = await reviewFieldSurveyAction(projectId, false, rejectionReason);
        if (res.success) {
          toast({ title: 'Survey Sent for Rework', description: 'Sent back to field team.', variant: 'success' });
          router.refresh();
        } else {
          toast({ title: 'Action Failed', description: res.error || 'Failed to review survey.', variant: 'error' });
        }
      } else if (rejectionModal.type === 'final') {
        const { engineerReviewFinalDeliverableAction } = await import("@/actions/review.actions");
        const res = await engineerReviewFinalDeliverableAction(projectId, false, rejectionReason, rejectionComments, rejectionInstructions);
        if (res.success) {
          toast({ title: 'Final Deliverable Rejected', description: 'Project returned to Deliverable Finalization stage.', variant: 'success' });
          router.refresh();
        } else {
          toast({ title: 'Rejection Failed', description: res.error || 'An error occurred.', variant: 'error' });
        }
      }
      setRejectionModal({ isOpen: false, type: null });
      setLoadingAction(null);
    });
  };

  const handleSubmitSurveyData = () => {
    setLoadingAction('submit_survey_data');
    startTransition(async () => {
      if (surveyDocs.length === 0) {
        toast({
          title: 'Submission Failed',
          description: 'Please upload survey data first.',
          variant: 'error'
        });
        return;
      }

      const stageRes = await updateProjectStageAction(
        projectId,
        'data_sync',
        'Survey data uploaded. Ready for review.'
      );

      if (stageRes?.success) {
        setSubmittedSections(prev => ({ ...prev, survey: Date.now() }));
        setSessionUploadedDocIds(prev => {
          const next = new Set(prev);
          allSurveyFiles.forEach((d: any) => next.delete(d.id));
          return next;
        });
        toast({
          title: 'Submitted Survey Data',
          description: 'Project moved to Data Sync stage.',
          variant: 'success'
        });
        onUpdateProject?.({ status: 'data_sync' });
        router.refresh();
      } else {
        toast({
          title: 'Submission Failed',
          description: stageRes?.error || 'An error occurred.',
          variant: 'error'
        });
      }
      setLoadingAction(null);
    });
  };

  const handleSubmitFinalReport = () => {
    setLoadingAction('submit_final_report');
    startTransition(async () => {
      if (finalDocs.length === 0) {
        toast({
          title: 'Submission Failed',
          description: 'Please upload a final deliverable first.',
          variant: 'error'
        });
        return;
      }

      const targetFinal = latestFinal || finalDocs[0];
      const { submitCADRevisionAction } = await import("@/actions/operations.actions");
      const revRes = await submitCADRevisionAction(
        projectId,
        targetFinal.file_name,
        targetFinal.file_url,
        'Final Deliverable submission',
        'final'
      );

      if (!revRes.success) {
        toast({
          title: 'Submission Failed',
          description: revRes.error || 'Failed to submit final deliverable revision.',
          variant: 'error'
        });
        setLoadingAction(null);
        return;
      }

      const stageRes = await updateProjectStageAction(
        projectId,
        'final_review',
        'Final Deliverable submitted for engineering validation.'
      );

      if (stageRes?.success) {
        setSubmittedSections(prev => ({ ...prev, final: Date.now() }));
        setSessionUploadedDocIds(prev => {
          const next = new Set(prev);
          finalDocs.forEach((d: any) => next.delete(d.id));
          return next;
        });
        toast({
          title: 'Submitted for Validation',
          description: 'Project moved to Final Review stage.',
          variant: 'success'
        });
        onUpdateProject?.({ status: 'final_review' });
        router.refresh();
      } else {
        toast({
          title: 'Stage Update Failed',
          description: stageRes?.error || 'An error occurred.',
          variant: 'error'
        });
      }
      setLoadingAction(null);
    });
  };


  const handleDeleteFile = (fileId: string, fileName: string) => {
    if (!confirm(`Are you sure you want to delete ${fileName}?`)) return;

    setLoadingAction(`delete_file_${fileId}`);
    startTransition(async () => {
      const res = await deleteFileAction(fileId, projectId);
      if (res.success) {
        toast({
          title: 'Deleted',
          description: 'File has been deleted.',
          variant: 'success'
        });
        onUpdateFiles?.(files.filter((f: any) => f.id !== fileId));
      } else {
        toast({
          title: 'Delete Failed',
          description: res.error || 'Could not delete file.',
          variant: 'error'
        });
      }
      setLoadingAction(null);
    });
  };

  if (!isAdmin && !isEngineer && !isField) return null;

  return (
    <div className="flex flex-col gap-5">
      <Dialog open={rejectionModal.isOpen} onOpenChange={(open) => !open && setRejectionModal({ isOpen: false, type: null })}>
        <DialogContent className="sm:max-w-[480px] bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-3xl p-0 shadow-2xl overflow-hidden">
          {/* Header section with a subtle red gradient background */}
          <div className="bg-gradient-to-b from-rose-50/80 to-white dark:from-rose-950/20 dark:to-slate-900 px-6 pt-6 pb-4 border-b border-rose-100 dark:border-rose-900/30">
            <DialogHeader>
              <div className="flex items-center gap-4 mb-1">
                <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center shrink-0 border border-rose-200 dark:border-rose-500/30">
                  <XCircle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold text-slate-800 dark:text-white">
                    Provide Rejection Reason
                  </DialogTitle>
                  <DialogDescription className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
                    Please explain why this document is being rejected so the team can rework it.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>
          
          <div className="px-6 py-5 flex flex-col gap-5">
            <div className="space-y-2 text-left">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Rejection Reason <span className="text-rose-500">*</span></label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Describe the issue in detail..."
                className="w-full bg-slate-50/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-400 transition-all text-slate-800 dark:text-white min-h-[120px] resize-none shadow-inner"
              />
            </div>
            {rejectionModal.type === 'final' && (
              <>
                <div className="space-y-2 text-left">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Comments (Optional)</label>
                  <textarea
                    value={rejectionComments}
                    onChange={(e) => setRejectionComments(e.target.value)}
                    placeholder="Any additional comments..."
                    className="w-full bg-slate-50/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-400 transition-all text-slate-800 dark:text-white min-h-[80px] resize-none shadow-inner"
                  />
                </div>
                <div className="space-y-2 text-left">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Revision Instructions (Optional)</label>
                  <textarea
                    value={rejectionInstructions}
                    onChange={(e) => setRejectionInstructions(e.target.value)}
                    placeholder="Specific instructions for revision..."
                    className="w-full bg-slate-50/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-400 transition-all text-slate-800 dark:text-white min-h-[80px] resize-none shadow-inner"
                  />
                </div>
              </>
            )}
          </div>
          
          <div className="px-6 py-4 bg-slate-50 dark:bg-white/5 border-t border-slate-100 dark:border-white/5 flex gap-3 sm:justify-end">
            <button
              disabled={isPending}
              onClick={() => setRejectionModal({ isOpen: false, type: null })}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl font-bold text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 text-slate-600 dark:text-slate-300 transition-all shadow-sm hover:shadow-md"
            >
              Cancel
            </button>
            <button
              disabled={isPending || !rejectionReason.trim()}
              onClick={submitRejection}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-bold text-sm bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 hover:shadow-rose-500/30 flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none disabled:shadow-none"
            >
              {isPending && loadingAction === 'submit_rejection' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              Reject Document
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Progress Overlay */}
      {isUploading && (
        <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 space-y-2 animate-in fade-in duration-300">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600 font-bold tracking-wider flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-500" /> Uploading to secure vault...
            </span>
            <span className="font-bold text-indigo-600">{uploadProgress}%</span>
          </div>
          <div className="w-full h-2 bg-indigo-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      )}

      {/* Active Rework / Revision Banner */}
      {activeRework && (
        <ActiveReworkBanner rework={activeRework} />
      )}

      {/* Top Section: Client Documents */}
      <CollapsibleWidget
        title="Client Documents"
        icon={BookOpen}
        defaultExpanded={false}
        badgeCount={clientDocs.length}
        rightAction={
          (isAdmin || isEngineer) && !isProjectClosed && (
            <label className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 cursor-pointer transition flex items-center gap-2 shadow-sm text-xs font-bold border border-indigo-100 dark:border-indigo-500/20">
              <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Upload</span>
              <input type="file" className="hidden" onChange={handleUploadClientDoc} disabled={isUploading} />
            </label>
          )
        }
      >
        <div className="space-y-3">
          {clientDocs.map((file: any) => (
            <div key={file.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 group transition-colors hover:bg-slate-100 dark:hover:bg-white/10">
              <div className="flex items-center gap-3 min-w-0 flex-1 mr-4">
                <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm">
                  <FileText className="w-4 h-4 text-indigo-500" />
                </div>
                <span className="font-semibold text-sm text-slate-700 dark:text-slate-300 truncate" title={file.file_name}>
                  {file.file_name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a href={file.file_url} target="_blank" rel="noreferrer noopener" title="Preview" className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-800 transition">
                  <Eye className="w-4 h-4" />
                </a>
                <button onClick={() => downloadFile(file.file_url, file.file_name)} title="Download" className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-800 transition">
                  <Download className="w-4 h-4" />
                </button>
                {(isAdmin || isEngineer) && !isProjectClosed && (
                  <button onClick={() => handleDeleteFile(file.id, file.file_name)} disabled={isPending} title="Delete" className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition disabled:opacity-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {clientDocs.length === 0 && (
            isProjectClosed ? (
              <div className="h-32 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl text-center bg-slate-50/50 dark:bg-white/5 opacity-60">
                <FolderOpen className="w-6 h-6 text-slate-400 mb-2" />
                <p className="text-xs font-semibold text-slate-500">No Client Documents Uploaded</p>
              </div>
            ) : (
              <label className="h-32 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl text-center bg-slate-50/50 dark:bg-white/5 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                <FolderOpen className="w-6 h-6 text-slate-400 mb-2" />
                <p className="text-xs font-semibold text-slate-500">{(isAdmin || isEngineer) ? "Click to upload Client Document" : "No Client Documents Uploaded Yet"}</p>
                {(isAdmin || isEngineer) && <input type="file" className="hidden" onChange={handleUploadClientDoc} disabled={isUploading} />}
              </label>
            )
          )}

          {/* Action Button */}
          {(isAdmin || isEngineer) && (
            isMidstage ? (
              <button
                onClick={handleSendUpdate}
                disabled={isPending || !hasNewClientDocUpload}
                className="w-full mt-4 flex items-center justify-center gap-2 px-5 py-3 border-2 border-indigo-600/20 hover:border-indigo-600 bg-indigo-50/50 hover:bg-indigo-50 dark:border-indigo-400/20 dark:hover:border-indigo-400 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-bold rounded-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm group"
              >
                {isPending && loadingAction === 'send_update' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4 group-hover:animate-bounce" />}
                {!hasNewClientDocUpload ? "No New Client Documents Uploaded" : "Notify Team of Supplemental Documents"}
              </button>
            ) : (
              <div className="mt-4 space-y-2">
                <button
                  onClick={handleSendToField}
                  disabled={isPending || !hasNewClientDocUpload || !hasFieldTeam}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                  title={!hasFieldTeam ? "Please assign a Field Crew member first" : undefined}
                >
                  {isPending && loadingAction === 'send_to_field' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {!hasNewClientDocUpload && clientDocs.length > 0 ? "Client Documents Dispatched" : "Proceed to Field Assignment"}
                </button>
                {!hasFieldTeam && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium text-center">
                    Please assign a Field Crew member in the Project Team section first.
                  </p>
                )}
              </div>
            )
          )}
        </div>
      </CollapsibleWidget>

      {/* Third Section: Field Survey Data */}
      <CollapsibleWidget
        title="Field Survey Data"
        icon={MapPin}
        defaultExpanded={activeRework?.type === 'survey' ? true : false}
        badgeCount={surveyDocs.length + controlPointDocs.length}
        rightAction={null}
      >
        <div className="space-y-8">

          {/* Part 1: Control Points */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                1. Control Point Images <span className="text-rose-500 text-xs   font-black px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-500/20">Required</span>
              </h4>
              {(isAdmin || isField) && !isProjectClosed && (
                <label className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 cursor-pointer transition flex items-center gap-2 shadow-sm text-xs font-bold border border-emerald-100 dark:border-emerald-500/20">
                  <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Upload Control Point</span>
                  <input type="file" className="hidden" onChange={handleUploadControlPoint} disabled={isUploading} accept="image/*" />
                </label>
              )}
            </div>

            <div className="space-y-3">
              {controlPointDocs.map((file: any) => (
                <div key={file.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 group transition-colors hover:bg-slate-100 dark:hover:bg-white/10">
                  <div className="flex items-center gap-3 min-w-0 flex-1 mr-4">
                    <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm">
                      <MapPin className="w-4 h-4 text-emerald-500" />
                    </div>
                    <span className="font-semibold text-sm text-slate-700 dark:text-slate-300 truncate" title={file.file_name}>
                      {file.file_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <a href={file.file_url} target="_blank" rel="noreferrer noopener" title="Preview" className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-white dark:hover:bg-slate-800 transition">
                      <Eye className="w-4 h-4" />
                    </a>
                    <button onClick={() => downloadFile(file.file_url, file.file_name)} title="Download" className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-white dark:hover:bg-slate-800 transition">
                      <Download className="w-4 h-4" />
                    </button>
                    {(isAdmin || isField) && !isProjectClosed && (
                      <button onClick={() => handleDeleteFile(file.id, file.file_name)} disabled={isPending} title="Delete" className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition disabled:opacity-50">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {controlPointDocs.length === 0 && (
                <div className="p-4 rounded-2xl border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/5 text-rose-600 dark:text-rose-400 flex items-center gap-3">
                  <p className="text-sm font-medium">Control point images must be uploaded before you can provide the survey data.</p>
                </div>
              )}
            </div>
          </div>

          <div className="h-px bg-slate-200 dark:bg-white/10" />

          {/* Part 2: Survey Data */}
          <div className={controlPointDocs.length === 0 ? "opacity-50 pointer-events-none relative" : ""}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                2. Survey Data
              </h4>
              {(isAdmin || isField) && !isProjectClosed && (
                <label className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 cursor-pointer transition flex items-center gap-2 shadow-sm text-xs font-bold border border-emerald-100 dark:border-emerald-500/20">
                  <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Upload Survey Data</span>
                  <input type="file" className="hidden" onChange={handleUploadSurveyData} disabled={isUploading} />
                </label>
              )}
            </div>
            <div className="space-y-3">
              {surveyDocs.map((file: any) => (
                <div key={file.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 group transition-colors hover:bg-slate-100 dark:hover:bg-white/10">
                  <div className="flex items-center gap-3 min-w-0 flex-1 mr-4">
                    <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm">
                      <FileText className="w-4 h-4 text-emerald-500" />
                    </div>
                    <span className="font-semibold text-sm text-slate-700 dark:text-slate-300 truncate" title={file.file_name}>
                      {file.file_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <a href={file.file_url} target="_blank" rel="noreferrer noopener" title="Preview" className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-white dark:hover:bg-slate-800 transition">
                      <Eye className="w-4 h-4" />
                    </a>
                    <button onClick={() => downloadFile(file.file_url, file.file_name)} title="Download" className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-white dark:hover:bg-slate-800 transition">
                      <Download className="w-4 h-4" />
                    </button>
                    {(isAdmin || isField) && !isProjectClosed && (
                      <button onClick={() => handleDeleteFile(file.id, file.file_name)} disabled={isPending} title="Delete" className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition disabled:opacity-50">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {surveyDocs.length === 0 && (
                <div className="h-24 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl text-center bg-slate-50/50 dark:bg-white/5 opacity-60">
                  <FolderOpen className="w-6 h-6 text-slate-400 mb-2" />
                  <p className="text-xs font-semibold text-slate-500">No Survey Data Uploaded</p>
                </div>
              )}
            </div>
          </div>

          {/* Materials & Equipment Return Status for Survey Validation */}
          {(isEngineer || isAdmin) && projectStatus === "data_sync" && projectMaterials.length > 0 && (
            <div className="mt-4">
              {pendingProjectMaterials.length > 0 ? (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <div>
                        <p className="font-bold text-amber-900 dark:text-amber-200">
                          Materials Submission / Accounting Required
                        </p>
                        <p className="text-[11px] text-amber-700 dark:text-amber-300">
                          {pendingProjectMaterials.length} material(s) assigned to this project must be returned or accounted for (reported missing with a responsible member) before survey validation.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => setIsSubmitMaterialsModalOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 transition shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Package className="w-3.5 h-3.5" />
                      <span>Submit / Report Missing</span>
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {pendingProjectMaterials.map((m: any) => (
                      <span key={m.id} className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-200/50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200">
                        {m.quantity}x {m.item} {m.assigned_to_name ? `(${m.assigned_to_name})` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="font-bold text-emerald-900 dark:text-emerald-200">
                        All {projectMaterials.length} Assigned Material(s) Accounted For ({submittedProjectMaterials.length} Submitted{lostProjectMaterials.length > 0 ? `, ${lostProjectMaterials.length} Reported Lost` : ''})
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 shrink-0">
                      Verified for Survey Validation
                    </span>
                  </div>
                  {lostProjectMaterials.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1 border-t border-emerald-500/15">
                      {lostProjectMaterials.map((m: any) => (
                        <span key={m.id} className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/20 flex items-center gap-1">
                          <PackageX className="w-3 h-3 text-rose-500" />
                          <span>{m.quantity}x {m.item}</span>
                          <span className="opacity-80">&bull; Resp: {m.responsible_person_name || 'Staff'}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Survey Validation Buttons */}
          {(isEngineer || isAdmin) && projectStatus === "data_sync" && surveyDocs.length > 0 && (
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => handleReviewSurveyInline(true)}
                disabled={isPending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl text-sm transition-all duration-300 shadow-sm hover:shadow-md hover:shadow-emerald-500/40 hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none"
              >
                {isPending && loadingAction === 'approve_survey' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Accept
              </button>
              <button
                onClick={() => handleReviewSurveyInline(false)}
                disabled={isPending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-rose-500 hover:bg-rose-400 text-white font-bold rounded-xl text-sm transition-all duration-300 shadow-sm hover:shadow-md hover:shadow-rose-500/40 hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none"
              >
                {isPending && loadingAction === 'reject_survey' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Rework
              </button>
            </div>
          )}

          {/* Submit Survey Data Button */}
          {(isAdmin || isField || isEngineer) && !isProjectClosed && (
            <button
              onClick={handleSubmitSurveyData}
              disabled={isPending || !hasNewSurveyUpload}
              className="w-full mt-4 flex items-center justify-center gap-2 px-5 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              {isPending && loadingAction === 'submit_survey_data' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : projectStatus === "data_sync" ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {projectStatus === "data_sync" && !hasNewSurveyUpload
                ? "Survey Data Submitted (Awaiting Validation)"
                : !hasNewSurveyUpload && surveyDocs.length > 0
                ? "No New Survey Data Uploaded"
                : projectStatus === "data_sync"
                ? "Resubmit / Update Survey Data"
                : "Submit Survey Data"}
            </button>
          )}
        </div>
      </CollapsibleWidget>

      {/* Bottom Section: Final Deliverables */}
      <CollapsibleWidget
        title="Final Deliverables"
        icon={BookOpen}
        defaultExpanded={activeRework?.type === 'final' || activeRework?.type === 'qc' ? true : false}
        badgeCount={finalDocs.length}
        rightAction={
          (isEngineer || isAdmin) && !isProjectClosed && (
            <label className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 cursor-pointer transition flex items-center gap-2 shadow-sm text-xs font-bold border border-blue-100 dark:border-blue-500/20">
              <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Upload</span>
              <input type="file" className="hidden" onChange={handleUploadFinalDoc} disabled={isUploading} />
            </label>
          )
        }
      >
        <div className="space-y-3">
          {finalDocs.map((file: any) => (
            <div key={file.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 group transition-colors hover:bg-slate-100 dark:hover:bg-white/10">
              <div className="flex items-center gap-3 min-w-0 flex-1 mr-4">
                <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm">
                  <FileText className="w-4 h-4 text-violet-500" />
                </div>
                <span className="font-semibold text-sm text-slate-700 dark:text-slate-300 truncate" title={file.file_name}>
                  {file.file_name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a href={file.file_url} target="_blank" rel="noreferrer noopener" title="Preview" className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-violet-600 hover:bg-white dark:hover:bg-slate-800 transition">
                  <Eye className="w-4 h-4" />
                </a>
                <button onClick={() => downloadFile(file.file_url, file.file_name)} title="Download" className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-violet-600 hover:bg-white dark:hover:bg-slate-800 transition">
                  <Download className="w-4 h-4" />
                </button>
                {(isAdmin || isEngineer) && !isProjectClosed && (
                  <button onClick={() => handleDeleteFile(file.id, file.file_name)} disabled={isPending} title="Delete" className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition disabled:opacity-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {finalDocs.length === 0 && (
            isProjectClosed ? (
              <div className="h-32 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl text-center bg-slate-50/50 dark:bg-white/5 opacity-60">
                <FolderOpen className="w-6 h-6 text-slate-400 mb-2" />
                <p className="text-xs font-semibold text-slate-500">No Final Deliverables Uploaded</p>
              </div>
            ) : (isEngineer || isAdmin) ? (
              <label className="h-32 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl text-center bg-slate-50/50 dark:bg-white/5 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                <FolderOpen className="w-6 h-6 text-slate-400 mb-2" />
                <p className="text-xs font-semibold text-slate-500">Click to upload Final Deliverable</p>
                <input type="file" className="hidden" onChange={handleUploadFinalDoc} disabled={isUploading} />
              </label>
            ) : (
              <div className="h-32 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl text-center bg-slate-50/50 dark:bg-white/5 opacity-60">
                <FolderOpen className="w-6 h-6 text-slate-400 mb-2" />
                <p className="text-xs font-semibold text-slate-500">No Final Deliverables Uploaded Yet</p>
              </div>
            )
          )}



          {/* Submit Final Deliverable Button */}
          {(isEngineer || isAdmin) && !isProjectClosed && (
            <button
              onClick={handleSubmitFinalReport}
              disabled={isPending || !hasNewFinalUpload || (latestCADRevision?.status === 'pending_review' && latestCADRevision?.revision_type === 'final')}
              className="w-full mt-4 flex items-center justify-center gap-2 px-5 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              {isPending && loadingAction === 'submit_final_report' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {latestCADRevision?.status === 'pending_review' && latestCADRevision?.revision_type === 'final'
                ? 'Validation Pending'
                : !hasNewFinalUpload && finalDocs.length > 0
                ? 'No New Deliverable Uploaded'
                : 'Submit Final Report & Send for Validation'}
            </button>
          )}

          {/* Engineer Final Deliverable Validation Buttons */}
          {(isEngineer || isAdmin) && (projectStatus === "final_review" || projectStatus === "data_sync") && finalDocs.length > 0 && !isProjectClosed && (
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => handleReviewFinalDeliverableInline(true)}
                disabled={isPending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl text-sm transition-all duration-300 shadow-sm hover:shadow-md hover:shadow-emerald-500/40 hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none"
              >
                {isPending && loadingAction === 'approve_final' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Approve
              </button>
              <button
                onClick={() => handleReviewFinalDeliverableInline(false)}
                disabled={isPending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-rose-500 hover:bg-rose-400 text-white font-bold rounded-xl text-sm transition-all duration-300 shadow-sm hover:shadow-md hover:shadow-rose-500/40 hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none"
              >
                {isPending && loadingAction === 'reject_final' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Reject
              </button>
            </div>
          )}
        </div>
      </CollapsibleWidget>

      {/* Submit / Lost Materials Modal */}
      <SubmitMaterialsModal
        open={isSubmitMaterialsModalOpen}
        onOpenChange={setIsSubmitMaterialsModalOpen}
        projectId={projectId}
        pendingMaterials={pendingProjectMaterials}
        teamMembers={teamMembers}
        onSuccess={() => {
          fetchMaterials();
        }}
      />
    </div>
  );
}

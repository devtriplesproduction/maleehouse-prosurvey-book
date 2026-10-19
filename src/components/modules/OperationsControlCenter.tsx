'use client';

import React, { useState } from 'react';
import {
  Shield,
  AlertTriangle,
  PenTool,
  MapPin,
  ClipboardCheck,
  Send,
  Loader2,
  XCircle,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  claimProjectAction,
  reviewFieldSurveyAction
} from '@/actions/operations.actions';
import { transitionWorkflowAction, reopenProjectAction } from '@/actions/workflow.actions';
import { FileUploader } from './FileUploader';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { registerFileAction } from '@/actions/file.actions';
import { uploadProjectFile } from '@/lib/supabase/storage';
import { deleteFileAction, renameFileAction } from '@/actions/vault.actions';
import { assignUserToProjectAction, removeUserFromProjectAction } from '@/actions/assignment.actions';
import { getOpsTeamMembersAction } from '@/actions/operations.actions';

interface OperationsControlCenterProps {
  projectId: string;
  projectStatus: string;
  userRole: string;
  currentUserId: string;
  teamMembers: any[];
  isFrozen?: boolean;
  files?: any[];
}

export function OperationsControlCenter({
  projectId,
  projectStatus,
  userRole,
  currentUserId,
  teamMembers,
  isFrozen = false,
  files = []
}: OperationsControlCenterProps) {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isTransitionOpen, setIsTransitionOpen] = useState(false);
  const [transitionComment, setTransitionComment] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const [fieldUsers, setFieldUsers] = useState<any[]>([]);
  const [selectedField, setSelectedField] = useState<string>("");
  const [isAssigningField, setIsAssigningField] = useState(false);
  const [showAddField, setShowAddField] = useState(false);
  const [removingFieldId, setRemovingFieldId] = useState<string | null>(null);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editSelectedField, setEditSelectedField] = useState<string>("");
  const [isEditingField, setIsEditingField] = useState(false);

  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [tempFileName, setTempFileName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  const [uploadingDocCategory, setUploadingDocCategory] = useState<string | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [isDeletingFile, setIsDeletingFile] = useState(false);

  // Data Sync Rejection States
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionNote, setRejectionNote] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);

  // Reopen Project States
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [isReopening, setIsReopening] = useState(false);

  React.useEffect(() => {
    if (userRole === 'engineer' && (projectStatus === 'project_created' || projectStatus === 'data_collection')) {
      const loadUsers = async () => {
        const result = await getOpsTeamMembersAction();
        if (result.success && result.data) {
          setFieldUsers(result.data.filter((u: any) => u.role === 'field'));
        }
      };
      loadUsers();
    }
  }, [userRole, projectStatus]);

  const handleRenameFile = async (fileId: string) => {
    if (!tempFileName.trim()) return;
    setIsRenaming(true);
    const result = await renameFileAction(fileId, projectId, tempFileName.trim());
    if (result?.success) {
      toast({ title: "File Renamed", variant: "success" });
      setRenamingFileId(null);
      setTempFileName("");
    } else {
      toast({ title: "Rename Failed", description: result?.error || undefined, variant: "error" });
    }
    setIsRenaming(false);
  };

  const handleDeleteFile = async (fileId: string, storagePath: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;
    setIsDeletingFile(true);
    try {
      const result = await deleteFileAction(fileId, projectId, storagePath);
      if (result?.success) {
        toast({ title: "Document Deleted", variant: "success" });
      } else {
        throw new Error(result?.error || "Deletion failed");
      }
    } catch (err: any) {
      toast({ title: "Delete Failed", description: err.message, variant: "error" });
    } finally {
      setIsDeletingFile(false);
    }
  };

  const handleUploadIntakeDoc = async (event: React.ChangeEvent<HTMLInputElement>, category: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingDoc(true);
    setUploadingDocCategory(category);

    try {
      const uploadResult = await uploadProjectFile(file, projectId);
      const registerResult = await registerFileAction({
        project_id: projectId,
        category: category as any,
        file_name: uploadResult.fileName,
        file_url: uploadResult.publicUrl,
        mime_type: uploadResult.mimeType,
        file_size: uploadResult.fileSize,
        storage_bucket: 'project-assets',
      });

      if (registerResult.success) {
        toast({ title: "Document Uploaded", description: `"${file.name}" uploaded successfully.`, variant: "success" });
        if (registerResult.data?.updated_project_stage) {
          toast({
            title: "Workflow Rewound",
            description: `Project state updated to ${registerResult.data.updated_project_stage} to resume work.`,
            variant: "default"
          });
          router.refresh();
        }
      } else {
        throw new Error(registerResult.error || "Failed to register file in database");
      }
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message, variant: "error" });
    } finally {
      setIsUploadingDoc(false);
      setUploadingDocCategory(null);
    }
  };

  const handleAssignField = async () => {
    if (!selectedField) return;
    setIsAssigningField(true);
    try {
      const result = await assignUserToProjectAction(projectId, selectedField, 'field');
      if (result?.success) {
        toast({ title: "Field Engineer Assigned", variant: "success" });
        setSelectedField("");
        setShowAddField(false);
      } else {
        throw new Error(result?.error || "Assignment failed");
      }
    } catch (err: any) {
      toast({ title: "Assignment Failed", description: err.message, variant: "error" });
    } finally {
      setIsAssigningField(false);
    }
  };

  const handleRemoveField = async (assignmentId: string) => {
    if (!confirm('Remove this Field engineer from the project?')) return;
    setRemovingFieldId(assignmentId);
    try {
      const result = await removeUserFromProjectAction(assignmentId, projectId);
      if (result?.success) {
        toast({ title: "Field Engineer Removed", variant: "success" });
      } else {
        throw new Error(result?.error || "Removal failed");
      }
    } catch (err: any) {
      toast({ title: "Remove Failed", description: err.message, variant: "error" });
    } finally {
      setRemovingFieldId(null);
    }
  };

  const handleEditField = async (assignmentId: string) => {
    if (!editSelectedField) return;
    setIsEditingField(true);
    try {
      await removeUserFromProjectAction(assignmentId, projectId);
      const result = await assignUserToProjectAction(projectId, editSelectedField, 'field');
      if (result?.success) {
        toast({ title: "Field Engineer Updated", variant: "success" });
        setEditingFieldId(null);
        setEditSelectedField("");
      } else {
        throw new Error(result?.error || "Update failed");
      }
    } catch (err: any) {
      toast({ title: "Update Failed", description: err.message, variant: "error" });
    } finally {
      setIsEditingField(false);
    }
  };

  const isAdmin = userRole === 'admin';
  const isAssigned = isAdmin || teamMembers.some((m: any) => m.userId === currentUserId);

  const isTransitionDisabled = isFrozen;

  const getWorkflowConfig = () => {
    switch (projectStatus) {
      case 'project_created':
        return {
          action: "Accept & Begin Data Collection",
          nextStage: "data_collection",
          icon: MapPin,
          color: "text-sky-500",
          bgColor: "bg-sky-500/10"
        };
      case 'data_collection':
        return {
          action: "Assign Field Team",
          nextStage: "field_assigned",
          icon: MapPin,
          color: "text-sky-500",
          bgColor: "bg-sky-500/10"
        };
      case 'field_assigned':
        return {
          action: "Dispatch Field Team",
          nextStage: "field_work",
          icon: MapPin,
          color: "text-cyan-500",
          bgColor: "bg-cyan-500/10"
        };
      case 'field_work':
        return {
          action: "Send for Data Sync",
          nextStage: "data_sync",
          icon: MapPin,
          color: "text-cyan-500",
          bgColor: "bg-cyan-500/10"
        };
      case 'data_sync':
        return {
          action: "Prepare Final Deliverable",
          nextStage: "final_review",
          icon: ClipboardCheck,
          color: "text-indigo-500",
          bgColor: "bg-indigo-500/10"
        };
      case 'final_review':
        return {
          action: "Complete Project",
          nextStage: "completed",
          icon: CheckCircle2,
          color: "text-emerald-500",
          bgColor: "bg-emerald-500/10"
        };
      default:
        return null;
    }
  };

  const handleReopenProject = async () => {
    if (!reopenReason.trim()) return;
    setIsReopening(true);
    const result = await reopenProjectAction(projectId, reopenReason);
    if (result.success) {
      toast({ title: "Project Reopened", variant: "success" });
      setIsReopenModalOpen(false);
      setReopenReason("");
    } else {
      toast({ title: "Reopen Failed", description: result.error || "Something went wrong.", variant: "error" });
    }
    setIsReopening(false);
  };

  const workflow = getWorkflowConfig();

  const handleTransition = async () => {
    if (!workflow || !transitionComment.trim()) return;

    setIsPending(true);
    try {
      const result = await transitionWorkflowAction(projectId, workflow.nextStage, transitionComment);
      if (result?.success) {
        toast({ title: "Workflow Synchronized", variant: "success" });
        setIsTransitionOpen(false);
        setTransitionComment("");
      } else {
        throw new Error(result?.error || "Transition failed");
      }
    } catch (err: any) {
      toast({ title: "Transition Failed", description: err.message, variant: "error" });
    } finally {
      setIsPending(false);
    }
  };

  const handleRejectDataSync = async () => {
    if (!rejectionNote.trim()) return;
    setIsRejecting(true);
    try {
      const res = await reviewFieldSurveyAction(projectId, false, rejectionNote);
      if (res?.success) {
        toast({ title: "Survey Rejected", description: "Project sent back to field team.", variant: "success" });
        setIsRejectModalOpen(false);
        setRejectionNote("");
      } else {
        throw new Error(res?.error || "Failed to reject survey data");
      }
    } catch (err: any) {
      toast({ title: "Rejection Failed", description: err.message, variant: "error" });
    } finally {
      setIsRejecting(false);
    }
  };

  const handleClaimProject = async () => {
    setIsClaiming(true);
    try {
      const result = await claimProjectAction(projectId);
      if (result?.success) {
        toast({ title: "Project Claimed", description: "You are now assigned to this operational squad.", variant: "success" });
      } else {
        throw new Error(result?.error || "Failed to claim project");
      }
    } catch (err: any) {
      toast({ title: "Claim Failed", description: err.message, variant: "error" });
    } finally {
      setIsClaiming(false);
    }
  };

  const intakeFiles = files.filter((f: any) => ['requirements', 'receipt', 'intake_document'].includes(f.category));

  if (isAssigned) {
    return null;
  }

  return (
    <div className="glass-card border-slate-200 dark:border-white/10 overflow-hidden flex flex-col h-full min-h-[400px]">
      <div className="flex-1 p-8 overflow-y-auto no-scrollbar">
        <div className="space-y-8 animate-in fade-in duration-500">
          {!isAssigned ? (
            <div className="p-6 rounded-3xl bg-amber-500/5 border border-amber-500/10 space-y-4">
              <div className="flex items-start gap-4 text-amber-500">
                <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-bold tracking-wide">Awaiting Acceptance</p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    You are not assigned to this project squad yet. Claim this project to join the operational team and unlock active operational tasks.
                  </p>
                </div>
              </div>
              {['engineer', 'field'].includes(userRole) && (
                <button
                  onClick={handleClaimProject}
                  disabled={isClaiming}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 disabled:opacity-50 text-white font-semibold shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5 active:translate-y-0"
                >
                  {isClaiming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                  Accept Assignment & Start Work
                </button>
              )}
            </div>
          ) : (
            // Standard View for non-engineers (Field, QC, etc.)
            <>

            </>
          )}
        </div>
      </div>

      <FileUploader
        projectId={projectId}
        open={isUploadOpen}
        onOpenChange={setIsUploadOpen}
      />

      <Dialog open={isTransitionOpen} onOpenChange={setIsTransitionOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {workflow && <workflow.icon className={cn("w-5 h-5", workflow.color)} />}
              Workflow Authorization
            </DialogTitle>
            <DialogDescription>
              Transitioning to <b>{workflow?.nextStage.replace('_', ' ')}</b>. Please provide an operational summary for the audit log.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 tracking-wider px-1">Transition Note</label>
              <Textarea
                placeholder="e.g., Field work requested for site X. Prerequisites verified."
                value={transitionComment}
                onChange={(e) => setTransitionComment(e.target.value)}
                className="min-h-[120px] rounded-2xl border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-indigo-500"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <button
              onClick={() => setIsTransitionOpen(false)}
              className="px-6 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-800 dark:hover:text-slate-200 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleTransition}
              disabled={isPending || !transitionComment.trim()}
              className={cn(
                "px-8 py-2.5 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-2",
                workflow?.bgColor.replace('/10', '') || "bg-indigo-600",
                (isPending || !transitionComment.trim()) && "opacity-50 cursor-not-allowed"
              )}
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Authorize Transition
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Survey Data Modal */}
      <Dialog open={isRejectModalOpen} onOpenChange={setIsRejectModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-500">
              <XCircle className="w-5 h-5" />
              Reject Survey Data
            </DialogTitle>
            <DialogDescription>
              This will send the project back to the field team (Survey Collection stage) for rework. Please provide detailed correction notes.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 tracking-wider px-1">Rejection Reason</label>
              <Textarea
                placeholder="e.g., The control points provided are inaccurate. Please resample area X."
                value={rejectionNote}
                onChange={(e) => setRejectionNote(e.target.value)}
                className="min-h-[120px] rounded-2xl border-rose-500/20 bg-rose-500/5 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-rose-500"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <button
              onClick={() => setIsRejectModalOpen(false)}
              className="px-6 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-800 dark:hover:text-slate-200 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleRejectDataSync}
              disabled={isRejecting || !rejectionNote.trim()}
              className={cn(
                "px-8 py-2.5 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700",
                (isRejecting || !rejectionNote.trim()) && "opacity-50 cursor-not-allowed"
              )}
            >
              {isRejecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
              Confirm Rejection
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reopen Project Modal */}
      <Dialog open={isReopenModalOpen} onOpenChange={setIsReopenModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-500">
              <AlertTriangle className="w-5 h-5" />
              Reopen Completed Project
            </DialogTitle>
            <DialogDescription>
              This action will unlock the project and transition it back to the Survey Data Sync stage, allowing deliverable corrections and Engineer validations.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 tracking-wider px-1">Reason for Reopening</label>
              <Textarea
                placeholder="e.g., Client requested title block revision."
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                className="min-h-[120px] rounded-2xl border-amber-500/20 bg-amber-500/5 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-amber-500"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <button
              onClick={() => setIsReopenModalOpen(false)}
              className="px-6 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-800 dark:hover:text-slate-200 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleReopenProject}
              disabled={isReopening || !reopenReason.trim()}
              className={cn(
                "px-8 py-2.5 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700",
                (isReopening || !reopenReason.trim()) && "opacity-50 cursor-not-allowed"
              )}
            >
              {isReopening ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
              Confirm Reopen
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

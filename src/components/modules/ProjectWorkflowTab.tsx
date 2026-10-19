'use client';

import React, { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Check,
  CheckCheck, 
  Clock, 
  Lock,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { transitionWorkflowAction } from '@/actions/workflow.actions';
import { useToast } from '@/hooks/use-toast';

interface ProjectWorkflowTabProps {
  projectId: string;
  projectStatus: string;
  userRole: string;
  isFrozen?: boolean;
  history?: any[];
  activityLogs?: any[];
  projectCreatedAt?: string;
  projectUpdatedAt?: string;
}

const formatStageDate = (date: Date) => {
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const formatStageTime = (date: Date) => {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
};

export interface StageConfig {
  id: number;
  label: string;
  description: string;
  responsibleRole: string;
  responsibleLabel: string;
  statusKey: string;
  nextStatusKey: string;
}

export const WORKFLOW_STAGES: StageConfig[] = [
  {
    id: 1,
    label: 'Project Created',
    description: 'Initial intake, payment verified, and technical project container created.',
    responsibleRole: 'accountant',
    responsibleLabel: 'Accountant',
    statusKey: 'project_created',
    nextStatusKey: 'data_collection'
  },
  {
    id: 2,
    label: 'Data Collection',
    description: 'Initial survey briefing, requirement gathering, and site analysis.',
    responsibleRole: 'engineer',
    responsibleLabel: 'Engineer',
    statusKey: 'data_collection',
    nextStatusKey: 'field_assigned'
  },
  {
    id: 3,
    label: 'Field Team Assignment',
    description: 'Allocating field survey crew and scheduling GPS visits.',
    responsibleRole: 'engineer',
    responsibleLabel: 'Engineer',
    statusKey: 'field_assigned',
    nextStatusKey: 'field_work'
  },
  {
    id: 4,
    label: 'Survey Collection',
    description: 'DGPS benchmark calculations and coordinate mappings on site.',
    responsibleRole: 'field',
    responsibleLabel: 'Field Engineer',
    statusKey: 'field_work',
    nextStatusKey: 'data_sync'
  },
  {
    id: 5,
    label: 'Survey Validation',
    description: 'Verification of survey raw files and site deliverables.',
    responsibleRole: 'engineer',
    responsibleLabel: 'Engineer',
    statusKey: 'data_sync',
    nextStatusKey: 'final_review'
  },
  {
    id: 6,
    label: 'Final Deliverable',
    description: 'Engineer uploads final verified documents and deliverables for handover.',
    responsibleRole: 'engineer',
    responsibleLabel: 'Engineer',
    statusKey: 'final_review',
    nextStatusKey: 'completed'
  },
  {
    id: 7,
    label: 'Delivered',
    description: 'Final files dispatched to clients. Project completed.',
    responsibleRole: 'admin',
    responsibleLabel: 'Admin',
    statusKey: 'completed',
    nextStatusKey: 'completed'
  }
];

function getStageTimestamp(
  stage: StageConfig,
  idx: number,
  currentIndex: number,
  history: any[],
  activityLogs: any[],
  projectCreatedAt?: string,
  projectUpdatedAt?: string
): Date | null {
  if (idx > currentIndex) return null;

  // 1. Stage 0 / Project Created
  if (idx === 0 || stage.statusKey === 'project_created') {
    let match = history.find((h: any) => 
      h.to_stage === stage.statusKey || 
      h.to_stage === 'payment_pending' || 
      h.to_stage === 'lead_created' || 
      h.to_stage === 'ready_for_dispatch'
    );
    if (!match && (activityLogs || []).length > 0) {
      match = activityLogs.find((l: any) => l.action === 'PROJECT_CREATED' || l.details?.to_stage === stage.statusKey);
    }
    if (!match && history.length > 0) {
      match = history[history.length - 1];
    }
    const raw = match?.created_at || projectCreatedAt;
    return raw ? new Date(raw) : null;
  }

  // 2. Direct match for entering this stage
  let match = history.find((h: any) => 
    h.to_stage === stage.statusKey || 
    h.new_status === stage.statusKey || 
    h.to_status === stage.statusKey
  );

  if (!match && (activityLogs || []).length > 0) {
    match = activityLogs.find((l: any) => 
      l.details?.to_stage === stage.statusKey || 
      l.details?.new_status === stage.statusKey ||
      l.stage === stage.statusKey
    );
  }

  // 3. If stage is completed but no direct entry log, check departure or next stage
  const isCompleted = idx < currentIndex;
  if (!match && isCompleted) {
    match = history.find((h: any) => h.from_stage === stage.statusKey);
    if (!match) {
      for (let nextIdx = idx + 1; nextIdx <= currentIndex; nextIdx++) {
        const nextKey = WORKFLOW_STAGES[nextIdx]?.statusKey;
        const nextMatch = history.find((h: any) => 
          h.to_stage === nextKey || 
          h.new_status === nextKey || 
          h.to_status === nextKey
        );
        if (nextMatch) {
          match = nextMatch;
          break;
        }
      }
    }
  }

  // 4. If stage is active but no history log, fall back to project updated_at or created_at
  const isActive = idx === currentIndex;
  if (!match && isActive) {
    const raw = projectUpdatedAt || projectCreatedAt;
    return raw ? new Date(raw) : null;
  }

  return match?.created_at ? new Date(match.created_at) : null;
}

export default function ProjectWorkflowTab({
  projectId,
  projectStatus,
  userRole,
  isFrozen = false,
  history = [],
  activityLogs = [],
  projectCreatedAt,
  projectUpdatedAt
}: ProjectWorkflowTabProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [comment, setComment] = useState('');
  const [localStatus, setLocalStatus] = useState(projectStatus);
  const [localHistory, setLocalHistory] = useState(history);

  useEffect(() => {
    setLocalStatus(projectStatus);
  }, [projectStatus]);

  useEffect(() => {
    setLocalHistory(history);
  }, [history]);

  // Map project status to current stage index
  const getStageIndex = (status: string): number => {
    switch (status) {
      case 'lead_created':
      case 'payment_pending':
      case 'payment_done':
      case 'project_created':
        return 0;
      case 'data_collection':
        return 1;
      case 'field_assigned':
        return 2;
      case 'field_work':
        return 3;
      case 'data_sync':
        return 4;
      case 'final_review':
        return 5;
      case 'completed':
      case 'archived':
        return 6;
      default:
        return 0;
    }
  };

  const currentIndex = getStageIndex(localStatus);
  const currentStage = WORKFLOW_STAGES[currentIndex];
  const nextStage = currentIndex < WORKFLOW_STAGES.length - 1 ? WORKFLOW_STAGES[currentIndex + 1] : null;

  // Determine if the logged in user is responsible for the current stage
  const isResponsible = () => {
    if (userRole === 'admin') return true;
    if (!currentStage) return false;
    
    // Check role specific mappings
    if (currentStage.responsibleRole === 'field' && (userRole === 'field')) return true;
    return currentStage.responsibleRole === userRole;
  };

  const handleAdvance = () => {
    if (!nextStage || isFrozen) return;

    startTransition(async () => {
      const res = await transitionWorkflowAction(projectId, nextStage.statusKey, comment || `Advanced to ${nextStage.label} by ${userRole}`);
      if (res?.success) {
        if (res.data?.status) {
          setLocalStatus(res.data.status);
          setLocalHistory(prev => [
            {
              id: `temp-${Date.now()}`,
              project_id: projectId,
              from_stage: currentStage.statusKey,
              to_stage: nextStage.statusKey,
              comment: comment || `Advanced to ${nextStage.label} by ${userRole}`,
              created_at: new Date().toISOString()
            },
            ...(prev || [])
          ]);
        }
        toast({
          title: 'Workflow Advanced',
          description: `Stage successfully transitioned to ${nextStage.label}.`,
          variant: 'success'
        });
        setComment('');
        router.refresh();
      } else {
        toast({
          title: 'Transition Gated',
          description: res?.error || 'Failed to transition workflow stage.',
          variant: 'error'
        });
      }
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Freeze blockade indicator */}
      {isFrozen && (
        <div className="p-4 rounded-2xl border border-red-500/10 bg-red-500/5 text-red-500 flex items-center gap-3 text-xs font-semibold animate-pulse">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>Project Frozen: All stage transitions and operational advancements are disabled until pending payments are settled.</span>
        </div>
      )}

      {/* Visual Workflow Steps Card */}
      <div className="glass-card border-slate-200 dark:border-white/10 bg-white dark:bg-[#09090b] rounded-3xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-white/5">
          <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Project Lifecycle Steps</h3>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">7-stage delivery pipeline tracked sequentially by department.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-slate-100 dark:border-white/5">
                <th className="py-3 px-4 w-16 text-center text-xs font-bold text-slate-500 dark:text-slate-400 capitalize"><Check className="w-4 h-4 mx-auto" /></th>
                <th className="py-3 px-4 w-40 text-xs font-bold text-slate-500 dark:text-slate-400 capitalize">Date & Time</th>
                <th className="py-3 px-4 text-xs font-bold text-slate-500 dark:text-slate-400 capitalize">Stage Name</th>
                <th className="py-3 px-4 w-48 text-xs font-bold text-slate-500 dark:text-slate-400 capitalize">Department</th>
                <th className="py-3 px-4 w-32 text-xs font-bold text-slate-500 dark:text-slate-400 capitalize">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {WORKFLOW_STAGES.map((stage, idx) => {
                const isCompleted = idx < currentIndex;
                const isActive = idx === currentIndex;
                
                const displayDate = getStageTimestamp(
                  stage,
                  idx,
                  currentIndex,
                  localHistory || [],
                  activityLogs || [],
                  projectCreatedAt,
                  projectUpdatedAt
                );

                return (
                  <tr 
                    key={stage.id} 
                    className={cn(
                      "transition-colors group animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both",
                      isActive ? "bg-indigo-50/30 dark:bg-indigo-500/5" : "hover:bg-slate-50/50 dark:hover:bg-white/[0.02]"
                    )}
                    style={{ animationDelay: `${idx * 40}ms` }}
                  >
                    <td className="py-3 px-4 text-center">
                      {isCompleted ? <CheckCheck className="w-4 h-4 mx-auto text-emerald-500" /> : 
                       isActive ? <Clock className="w-4 h-4 mx-auto text-indigo-500 animate-pulse" /> : 
                       <Lock className="w-4 h-4 mx-auto text-slate-300 dark:text-slate-700" />}
                    </td>
                    
                    <td className="py-3 px-4">
                      {displayDate ? (
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {formatStageDate(displayDate)}
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
                            {formatStageTime(displayDate)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs font-medium text-slate-400">none</span>
                      )}
                    </td>
                    
                    <td className="py-3 px-4">
                      <div className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        {stage.label}
                        {isActive && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">Active</span>}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">{stage.description}</div>
                    </td>
                    
                    <td className="py-3 px-4">
                      <span className="text-xs font-bold tracking-wide text-slate-600 dark:text-slate-300">
                        {stage.responsibleLabel}
                      </span>
                    </td>
                    
                    <td className="py-3 px-4">
                      {isCompleted ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-500">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Completed
                        </span>
                      ) : isActive ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" /> In Progress
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" /> Pending
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>



    </div>
  );
}

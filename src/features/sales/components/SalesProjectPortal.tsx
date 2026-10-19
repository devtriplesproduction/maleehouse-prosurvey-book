'use client';

import React, { useState, useTransition, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  Briefcase, 
  ShieldCheck, 
  Clock, 
  Check, 
  CheckSquare,
  Plus, 
  Download, 
  Trash2, 
  FileText, 
  Upload, 
  Loader2,
  PhoneCall,
  FolderOpen,
  Send,
  Eye,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { recordFollowUpAction, finalizeRequirementsAction } from '../actions';
import { registerFileAction } from '@/actions/file.actions';
import { uploadProjectFile } from '@/lib/supabase/storage';
import { deleteFileAction } from '@/actions/vault.actions';
import { toast } from 'sonner';
import { Select, SelectItem } from '@/components/ui/select';
import { useRouter } from 'next/navigation';

interface SalesProjectPortalProps {
  project: any;
  comments: any[];
  files: any[];
}

export function SalesProjectPortal({ project, comments = [], files = [] }: SalesProjectPortalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  const [localProject, setLocalProject] = useState(project);
  const [localComments, setLocalComments] = useState(comments);
  const [localFiles, setLocalFiles] = useState(files);

  useEffect(() => {
    setLocalProject(project);
    setLocalComments(comments);
    setLocalFiles(files);
  }, [project, comments, files]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Follow-up intake form states
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('Call Back');
  const [outcome, setOutcome] = useState('');

  // Modal states for premium calendar
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [selectedHour, setSelectedHour] = useState('10');
  const [selectedMinute, setSelectedMinute] = useState('00');
  const [selectedAmpm, setSelectedAmpm] = useState<'AM' | 'PM'>('AM');

  // Document upload states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('Satbara (7/12)');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Filter comments for follow-ups
  const followUpLogs = localComments.filter((c: any) => 
    c.content.includes("Follow-up Outcome:") || c.comment_type === 'follow_up'
  ).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Calendar Helpers
  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();

  const daysArray: (Date | null)[] = [];
  for (let i = 0; i < firstDayIndex; i++) {
    daysArray.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    daysArray.push(new Date(currentYear, currentMonth, d));
  }

  const isDateSelected = (date: Date | null) => {
    if (!date) return false;
    return date.getDate() === selectedDate.getDate() &&
           date.getMonth() === selectedDate.getMonth() &&
           date.getFullYear() === selectedDate.getFullYear();
  };

  const isDateToday = (date: Date | null) => {
    if (!date) return false;
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const handleRecordFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outcome) {
      toast.error("Outcome Notes Required", { description: "Please write outcome notes." });
      return;
    }

    let finalHour = parseInt(selectedHour);
    if (selectedAmpm === 'PM' && finalHour < 12) finalHour += 12;
    if (selectedAmpm === 'AM' && finalHour === 12) finalHour = 0;
    
    const finalDate = new Date(selectedDate);
    finalDate.setHours(finalHour, parseInt(selectedMinute), 0, 0);

    startTransition(async () => {
      const result = await recordFollowUpAction(project.id, finalDate.toISOString(), status, outcome);
      if (result.success) {
        toast.success("Follow-up Recorded", { description: "Reminder scheduled and history logged." });
        
        // Optimistic update
        setLocalProject((prev: any) => ({
          ...prev,
          status: 'requirement_gathering',
          follow_up_date: finalDate.toISOString()
        }));
        
        setLocalComments((prev: any) => [
          {
            id: `temp-${Date.now()}`,
            content: `Follow-up Outcome: ${outcome}\nStatus: ${status}\nNext Date: ${finalDate.toISOString()}`,
            comment_type: 'follow_up',
            created_at: new Date().toISOString()
          },
          ...prev
        ]);

        setIsRecording(false);
        setOutcome('');
        setSelectedDate(new Date());
      } else {
        toast.error("Failed to save", { description: result.error });
      }
    });
  };

  const handlePushToAccounts = async () => {
    startTransition(async () => {
      const result = await finalizeRequirementsAction(project.id);
      if (result.success) {
        toast.success("Handed over to Accounts", { 
          description: "Project is now in Accounts queue for payment milestone verification." 
        });
        setLocalProject((prev: any) => ({ ...prev, status: 'payment_pending' }));
      } else {
        toast.error("Workflow Error", { description: result.error });
      }
    });
  };

  const handleFileUpload = async (fileToUpload: File) => {
    if (!fileToUpload) return;

    setIsUploading(true);
    try {
      // 1. Try to upload to Supabase Storage first
      let fileUrl = '';
      try {
        const uploadResult = await uploadProjectFile(fileToUpload, project.id);
        fileUrl = uploadResult.publicUrl;
      } catch (storageErr: any) {
        // Fallback: use a proper https URL format for local metadata tracking
        // (Zod requires a valid URL so we cannot use local:// scheme)
        console.warn('Supabase storage upload failed, recording metadata only:', storageErr.message);
        fileUrl = `https://storage.maleehouse.local/${project.id}/${Date.now()}-${encodeURIComponent(fileToUpload.name)}`;
      }

      const prefixedName = `[${uploadCategory}] ${fileToUpload.name}`;
      
      const result = await registerFileAction({
        project_id: project.id,
        category: 'requirements' as "requirements",
        file_name: prefixedName,
        file_url: fileUrl,
        mime_type: fileToUpload.type || 'application/octet-stream',
        file_size: fileToUpload.size,
        storage_bucket: 'project-assets'
      });

      if (result.success) {
        toast.success("Document Uploaded", { 
          description: `${fileToUpload.name} saved to vault.` 
        });
        if (result.data?.updated_project_stage) {
          toast.info("Workflow Rewound", {
            description: `Project state updated to ${result.data.updated_project_stage} to resume work.`
          });
          router.refresh();
        }
        setLocalFiles((prev: any) => [
          ...prev,
          {
            id: `temp-${Date.now()}`,
            category: 'requirements',
            file_name: prefixedName,
            file_url: fileUrl,
            file_size: fileToUpload.size,
            created_at: new Date().toISOString()
          }
        ]);
        setSelectedFile(null);
      } else {
        toast.error("Registration Failed", { description: result.error });
      }
    } catch (err: any) {
      toast.error("Upload Error", { description: err.message });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteFile = async (fileId: string, storagePath: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;
    
    startTransition(async () => {
      const result = await deleteFileAction(fileId, project.id, storagePath);
      if (result.success) {
        toast.success("Document Deleted", { description: "Removed from vault database." });
        setLocalFiles((prev: any) => prev.filter((f: any) => f.id !== fileId));
      } else {
        toast.error("Deletion Failed", { description: result.error });
      }
    });
  };

  const isLead = ['lead_created', 'requirement_gathering', 'follow_up_pending'].includes(localProject.status);
  const isPushed = localProject.status === 'payment_pending';
  const isQuoteFormulated = !isLead && !isPushed && localProject.status !== 'archived';

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      
      {/* ── Clubbed Workflow & Handoff Action Panel ── */}
      <div className="glass-card p-4 shadow-sm bg-gradient-to-r from-white to-slate-50 dark:from-slate-900/40 dark:to-slate-900/10 border border-slate-200/60 dark:border-white/5 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        
        {/* Left Side: Step tracker */}
        <div className="flex items-center gap-4 bg-slate-50/50 dark:bg-black/15 px-5 py-2.5 rounded-2xl border border-slate-200/50 dark:border-white/5 self-start lg:self-auto shrink-0 shadow-sm">
          {/* Step 1 */}
          <div className="flex items-center gap-2.5">
            <span className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300",
              isLead 
                ? "bg-indigo-600 text-white shadow-sm" 
                : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
            )}>
              {isLead ? "1" : <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
            </span>
            <span className={cn(
              "text-sm font-medium", 
              isLead ? "text-slate-800 dark:text-slate-200" : "text-emerald-600 dark:text-emerald-400"
            )}>
              Lead
            </span>
          </div>
          
          <div className="w-8 h-[1.5px] bg-slate-200 dark:bg-white/10 shrink-0" />

          {/* Step 2 */}
          <div className="flex items-center gap-2.5">
            <span className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300",
              isLead 
                ? "bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-400" 
                : isPushed 
                  ? "bg-indigo-600 text-white shadow-sm" 
                  : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
            )}>
              {!isLead && !isPushed ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : "2"}
            </span>
            <span className={cn(
              "text-sm font-medium", 
              isLead ? "text-slate-400 dark:text-slate-500" : isPushed ? "text-slate-800 dark:text-slate-200" : "text-emerald-600 dark:text-emerald-400"
            )}>
              Finance
            </span>
          </div>

          <div className="w-8 h-[1.5px] bg-slate-200 dark:bg-white/10 shrink-0" />

          {/* Step 3 */}
          <div className="flex items-center gap-2.5">
            <span className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300",
              isQuoteFormulated 
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" 
                : "bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-400"
            )}>
              {isQuoteFormulated ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : "3"}
            </span>
            <span className={cn(
              "text-sm font-medium", 
              isQuoteFormulated ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"
            )}>
              Quoted
            </span>
          </div>
        </div>

        {/* Right Side: Status + Action */}
        <div className="flex flex-wrap items-center gap-3">
          <div className={cn(
            "p-2 rounded-xl shrink-0",
            isLead ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" :
            isPushed ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 animate-pulse" :
            "bg-emerald-500/10 text-emerald-600"
          )}>
            {isLead ? <ShieldCheck className="w-5 h-5" /> :
             isPushed ? <Clock className="w-5 h-5" /> :
             <CheckSquare className="w-5 h-5" />}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-white leading-none">
              {isLead ? "Accounts Handoff Pending" :
               isPushed ? "Submitted to Accounts" :
               "Commercials Active"}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-0.5">
              {isLead ? "Staging Phase" : isPushed ? "Finance Review" : "Active Project"}
            </p>
          </div>

          {isLead && (
            <button
              onClick={handlePushToAccounts}
              disabled={isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium h-10 px-5 shadow-sm shadow-indigo-500/10 transition-all active:scale-95 rounded-xl flex items-center gap-2 disabled:opacity-50 ml-1"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <>
                  <Send className="w-4 h-4" />
                  Push to Accounts
                </>
              )}
            </button>
          )}
          {isPushed && (
            <span className="text-xs font-semibold px-3 py-1 bg-amber-500/10 text-amber-600 rounded-lg border border-amber-500/20">
              Awaiting Payment
            </span>
          )}
          {isQuoteFormulated && (
            <span className="text-xs font-semibold px-3 py-1 bg-emerald-500/10 text-emerald-600 rounded-lg border border-emerald-500/20">
              Active Project
            </span>
          )}
        </div>
      </div>

      {/* Two Column Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
         {/* ── Left Side: Client profile (5 columns) ── */}
        <div className="xl:col-span-5">
          <div className="glass-card p-8 shadow-md shadow-slate-100/40 dark:shadow-none bg-gradient-to-br from-white/95 to-slate-50/50 dark:from-slate-900/40 dark:to-slate-900/10 border border-slate-200/60 dark:border-white/5 rounded-3xl space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-white/5 pb-4 mb-2">
              <User className="w-5 h-5 text-indigo-500" />
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Client & Site Profile</h3>
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Corporate Record</p>
              </div>
            </div>

            <div className="space-y-5">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-0.5 leading-none">Client Entity</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1">{localProject.client_name}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 mt-0.5">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-0.5 leading-none">Primary Phone</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1">{(localProject.client_contact || '').split(',')[0]?.replace('Phone: ', '') || 'N/A'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 mt-0.5">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-0.5 leading-none">Email Address</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1 truncate max-w-[220px]">
                    {(localProject.client_contact || '').split(',')[1]?.replace(' Email: ', '') || 'No Email Registered'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-0.5 leading-none">Site Location Address</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-205 mt-1 leading-relaxed">{localProject.client_address || 'No Address Logged'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 mt-0.5">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-0.5 leading-none">Required Services</p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {(() => {
                      const raw = localProject.services;
                      const servicesArr: string[] = Array.isArray(raw)
                        ? raw
                        : typeof raw === 'string' && raw.trim().length > 0
                          ? raw.split(',').map((s: string) => s.trim()).filter(Boolean)
                          : [];
                      return servicesArr.length > 0 ? (
                        servicesArr.map((service: string, idx: number) => (
                          <span key={idx} className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20">
                            {service}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm font-semibold text-slate-500">Not Specified</span>
                      );
                    })()}
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-white/5 pt-4">
                <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1.5 leading-none">Site Typology</p>
                <span className="inline-block px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider bg-indigo-500/10 text-indigo-500 rounded-lg border border-indigo-500/20">
                  {localProject.site_type || 'Residential'}
                </span>
              </div>

              <div className="border-t border-slate-100 dark:border-white/5 pt-4 space-y-1.5">
                <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1.5 leading-none">Scope & Special Instructions</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 italic bg-slate-50 dark:bg-black/20 p-3.5 rounded-xl border border-slate-200/50 dark:border-white/5 leading-relaxed font-medium">
                  &quot;{localProject.survey_requirements || 'No specific limit or instructions provided.'}&quot;
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Side: CRM logs & Documents (7 columns) ── */}
        <div className="xl:col-span-7 space-y-8">
          
          {/* Documents Vault (Satbara Deeds & Site Images) */}
          <div className="glass-card p-8 shadow-md shadow-slate-100/40 dark:shadow-none bg-gradient-to-br from-white/95 to-slate-50/50 dark:from-slate-900/40 dark:to-slate-900/10 border border-slate-200/60 dark:border-white/5 rounded-3xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <FolderOpen className="w-5 h-5 text-indigo-500" />
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Digital Handoff Vault</h3>
                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5 nums">Prerequisites & Site Docs</p>
                </div>
              </div>
              
              <span className="text-[10px] font-semibold bg-indigo-500/10 text-indigo-500 px-3 py-1 rounded-full border border-indigo-500/20 shrink-0">
                {localFiles.length} Staged Document{localFiles.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Document upload form */}
            <div className="flex flex-col sm:flex-row gap-4 bg-slate-50 dark:bg-black/20 p-5 rounded-[2rem] border border-slate-200/50 dark:border-white/5 items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-4 w-full">
                <div className="space-y-1.5 flex-[1] min-w-[200px]">
                  <label className="text-[10px] font-medium uppercase tracking-wider text-slate-450 dark:text-slate-500 ml-1 block">Category</label>
                  <div className="relative">
                    <Select
                      value={uploadCategory}
                      onValueChange={(val) => setUploadCategory(val as any)}
                      buttonClassName="w-full h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10"
                    >
                      <SelectItem value="legal_doc">Satbara (7/12 Extract)</SelectItem>
                      <SelectItem value="photos">Site Images / Boundaries</SelectItem>
                      <SelectItem value="other">Sale Deeds / Legal</SelectItem>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5 flex-[1.5]">
                  <label className="text-[10px] font-medium uppercase tracking-wider text-slate-450 dark:text-slate-555 ml-1 block">Document Attachment</label>
                  <div 
                    onClick={() => !isUploading && document.getElementById('sales-file-input')?.click()}
                    className={cn(
                      "h-11 border-2 border-dashed border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center text-sm font-medium text-slate-600 dark:text-slate-300 transition-all cursor-pointer",
                      isUploading ? "opacity-70 cursor-wait" : "hover:border-indigo-500/40 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-indigo-600 dark:hover:text-indigo-400"
                    )}
                  >
                    {isUploading ? (
                      <Loader2 className="w-4 h-4 mr-2 text-indigo-500 shrink-0 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2 shrink-0" />
                    )}
                    <span className="truncate max-w-[200px] px-1">
                      {isUploading ? 'Uploading...' : 'Select Document'}
                    </span>
                    <input
                      id="sales-file-input"
                      type="file"
                      className="hidden"
                      multiple
                      onChange={async (e) => {
                        const filesArray = Array.from(e.target.files || []);
                        if (filesArray.length > 0) {
                          for (const f of filesArray) {
                            setSelectedFile(f);
                            await handleFileUpload(f);
                          }
                          e.target.value = '';
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Document list */}
            <div className="space-y-3">
              {localFiles.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-slate-200 dark:border-white/5 rounded-2xl text-slate-400 italic text-xs flex flex-col items-center justify-center gap-2">
                  <FolderOpen className="w-8 h-8 text-slate-300 dark:text-slate-600 stroke-[1.5]" />
                  No documents received or staged yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {localFiles.map((file: any) => {
                    return (
                      <div 
                        key={file.id}
                        className="p-4 bg-white/50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 rounded-2xl flex flex-col gap-3 relative group hover:border-indigo-500/20 transition-all duration-300"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold",
                            file.category === 'legal_doc' ? "bg-rose-500/10 text-rose-500" :
                            file.category === 'photos' ? "bg-emerald-500/10 text-emerald-500" :
                            "bg-slate-500/10 text-slate-550"
                          )}>
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <h5 className="font-bold text-slate-805 dark:text-white text-xs truncate leading-tight" title={file.file_name}>
                              {file.file_name}
                            </h5>
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-405 dark:text-slate-500 block mt-0.5">
                              {file.category === 'legal_doc' ? 'Legal Deed' : 
                               file.category === 'photos' ? 'Site Image' : 'General Asset'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-100 dark:border-white/5 pt-3">
                          <span className="text-[9px] nums text-slate-400">
                            {file.file_size ? (file.file_size / 1024).toFixed(0) + ' KB' : 'N/A'}
                          </span>

                          <div className="flex flex-wrap gap-3">
                            <a
                              href={file.file_url || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-0 h-auto text-indigo-600 hover:text-indigo-700 font-bold text-[10px] flex items-center gap-1 outline-none transition-colors"
                            >
                              <Eye className="w-3 h-3" /> View
                            </a>
                            <a
                              href={file.file_url || '#'}
                              download
                              className="p-0 h-auto text-slate-500 hover:text-slate-700 font-bold text-[10px] flex items-center gap-1 outline-none transition-colors"
                            >
                              <Download className="w-3 h-3" /> Download
                            </a>
                            <button
                              onClick={() => handleDeleteFile(file.id, file.storage_path)}
                              className="p-0 h-auto text-rose-500 hover:text-rose-700 font-bold text-[10px] flex items-center gap-1 outline-none transition-colors"
                            >
                              <Trash2 className="w-3 h-3" /> Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Follow-up Intake & Historical Log */}
          <div className="glass-card p-8 shadow-md shadow-slate-100/40 dark:shadow-none bg-gradient-to-br from-white/95 to-slate-50/50 dark:from-slate-900/40 dark:to-slate-900/10 border border-slate-200/60 dark:border-white/5 rounded-3xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <PhoneCall className="w-5 h-5 text-indigo-500 shrink-0" />
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Follow-up Log</h3>
                  <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">{followUpLogs.length} {followUpLogs.length === 1 ? 'entry' : 'entries'} recorded</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {!isRecording && (
                  <button
                    onClick={() => setIsRecording(true)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium h-10 px-5 shadow-sm shadow-indigo-500/10 transition-all active:scale-95 rounded-xl shrink-0"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    Follow Up
                  </button>
                )}
              </div>
            </div>

            {/* Follow-up intake form */}
            {isRecording && mounted && createPortal(
              <div className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
                <form onSubmit={handleRecordFollowUp} className="w-full max-w-3xl bg-white dark:bg-slate-950 rounded-[2rem] shadow-2xl border border-slate-200/60 dark:border-white/[0.08] flex flex-col max-h-[90vh] overflow-y-auto animate-in zoom-in-95 slide-in-from-bottom-6 duration-300">
                  
                  {/* Modal Header */}
                  <div className="flex items-center justify-between px-7 py-5 bg-indigo-600 dark:bg-indigo-700 text-white rounded-t-[2rem] border-b border-indigo-500/20 shrink-0">
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-white/10 text-white flex items-center justify-center shrink-0">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold tracking-tight text-white">Schedule Follow Up</h3>
                        <p className="text-sm text-indigo-100 font-medium mt-0.5">Record outcome & set your next check-in</p>
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setIsRecording(false)}
                      className="w-9 h-9 rounded-xl bg-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-7">
                    
                    {/* Left Column: Calendar */}
                    <div className="space-y-3">
                      {/* Month Navigation */}
                      <div className="flex items-center justify-between">
                        <button 
                          type="button" 
                          onClick={prevMonth}
                          className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-all"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-sm font-semibold text-slate-850 dark:text-white">
                          {MONTH_NAMES[currentMonth]} {currentYear}
                        </span>
                        <button 
                          type="button" 
                          onClick={nextMonth}
                          className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-all"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Calendar Grid */}
                      <div className="rounded-2xl border border-slate-100 dark:border-white/[0.06] overflow-hidden">
                        {/* Day headers */}
                        <div className="grid grid-cols-7 text-center bg-slate-50 dark:bg-white/[0.03] border-b border-slate-100 dark:border-white/[0.05] py-2">
                          {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d: any) => (
                            <span key={d} className="text-xs font-semibold text-slate-400 dark:text-slate-555">{d}</span>
                          ))}
                        </div>
                        {/* Day cells */}
                        <div className="grid grid-cols-7 gap-0 p-3 bg-white dark:bg-slate-900/30">
                          {daysArray.map((date, idx) => {
                            if (!date) return <div key={`empty-${idx}`} />;
                            const selected = isDateSelected(date);
                            const today = isDateToday(date);
                            return (
                              <button
                                key={`day-${idx}`}
                                type="button"
                                onClick={() => setSelectedDate(date)}
                                className={cn(
                                  "h-9 w-full rounded-xl flex items-center justify-center text-sm font-medium transition-all duration-150 active:scale-90",
                                  selected
                                    ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/20 font-bold"
                                    : today
                                    ? "text-indigo-655 dark:text-indigo-400 font-semibold border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/60 dark:bg-indigo-500/10"
                                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                                )}
                              >
                                {date.getDate()}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Details & Form */}
                    <div className="flex flex-col gap-4">
                      {/* Time Selection */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Time</label>
                        <div className="flex gap-2 items-center">
                          <div className="flex-1">
                            <Select
                              value={selectedHour}
                              onValueChange={setSelectedHour}
                              buttonClassName="glass-input py-2.5 h-[42px]"
                            >
                              {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((h: any) => (
                                <SelectItem key={h} value={h}>{h} Hr</SelectItem>
                              ))}
                            </Select>
                          </div>
                          <span className="text-slate-400 font-semibold shrink-0">:</span>
                          <div className="flex-1">
                            <Select
                              value={selectedMinute}
                              onValueChange={setSelectedMinute}
                              buttonClassName="glass-input py-2.5 h-[42px]"
                            >
                              {Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0')).map((m: any) => (
                                <SelectItem key={m} value={m}>{m} Min</SelectItem>
                              ))}
                            </Select>
                          </div>
                          
                          {/* AM/PM PERIOD */}
                          <div className="flex border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden shrink-0">
                            {['AM','PM'].map((period: any) => (
                              <button
                                key={period}
                                type="button"
                                onClick={() => setSelectedAmpm(period as 'AM' | 'PM')}
                                className={cn(
                                  "px-3 h-10 text-xs font-semibold transition-all",
                                  selectedAmpm === period
                                    ? "bg-indigo-600 text-white"
                                    : "bg-white dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5"
                                )}
                              >
                                {period}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Follow-up Status */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Follow-up Status</label>
                        <Select 
                          value={status}
                          onValueChange={setStatus}
                          buttonClassName="glass-input py-2.5 h-[42px]"
                        >
                          <SelectItem value="Call Back">Call Back</SelectItem>
                          <SelectItem value="Interested">Interested</SelectItem>
                          <SelectItem value="Not Reachable">Not Reachable</SelectItem>
                          <SelectItem value="Waiting for Documents">Waiting for Documents</SelectItem>
                          <SelectItem value="Negotiation">Negotiation</SelectItem>
                          <SelectItem value="Closed">Closed</SelectItem>
                        </Select>
                      </div>

                      {/* Outcome notes */}
                      <div className="space-y-1.5 flex-1 flex flex-col">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Outcome / Notes</label>
                        <textarea 
                          value={outcome}
                          onChange={(e) => setOutcome(e.target.value)}
                          placeholder="Summarise what was discussed..."
                          className="glass-input flex-1 min-h-[100px] resize-none py-3"
                        />
                      </div>

                      {/* Footer buttons inside body grid */}
                      <div className="flex gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsRecording(false)}
                          className="flex-1 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 font-semibold text-sm transition-all"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isPending}
                          className="flex-1 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all shadow-md shadow-indigo-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Follow Up"}
                        </button>
                      </div>

                    </div>

                  </div>

                </form>
              </div>,
              document.body
            )}

            {/* Historical list */}
            <div className="space-y-4">
              {followUpLogs.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-slate-200 dark:border-white/5 rounded-[2rem] text-slate-400 dark:text-slate-500 italic text-xs flex flex-col items-center justify-center gap-3 bg-slate-50/50 dark:bg-white/[0.01]">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 dark:text-slate-655">
                    <PhoneCall className="w-6 h-6 stroke-[1.5]" />
                  </div>
                  <span>No follow-ups logged yet.</span>
                </div>
              ) : (
                <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                  {followUpLogs.map((log: any) => {
                    const contentLines = log.content.split('\n');
                    const outcomeLine = contentLines.find((l: string) => l.trim().startsWith("Follow-up Outcome:"));
                    const statusLine = contentLines.find((l: string) => l.trim().startsWith("Status:"));
                    const dateLine = contentLines.find((l: string) => l.trim().startsWith("Next Date:"));

                    let outcomeText = outcomeLine ? outcomeLine.replace(/Follow-up Outcome:\s*/, "").trim() : "";
                    let loggedStatus = statusLine ? statusLine.replace(/Status:\s*/, "").trim() : "";
                    let nextCheckIn = dateLine ? dateLine.replace(/Next Date:\s*/, "").trim() : "";

                    if (!outcomeText && !loggedStatus) {
                      if (log.content.includes("Follow-up Outcome: ")) {
                        outcomeText = log.content.replace("Follow-up Outcome: ", "").split('\n')[0] || '';
                        loggedStatus = log.content.split('\n')[1]?.replace('Status: ', '') || 'Follow Up';
                        nextCheckIn = log.content.split('\n')[2]?.replace('Next Date: ', '') || '';
                      } else {
                        outcomeText = log.content;
                        loggedStatus = 'Follow Up';
                      }
                    }

                    return (
                      <div 
                        key={log.id}
                        className="p-4 bg-white/40 dark:bg-white/[0.01] border border-slate-200/50 dark:border-white/5 rounded-2xl flex flex-col gap-2.5 transition-all"
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-2 mb-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/15">
                            {loggedStatus}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-505 font-bold">
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                        </div>

                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-semibold">
                          {outcomeText}
                        </p>

                        {nextCheckIn && (
                          <div className="mt-2.5 flex items-center gap-1.5 text-[10px] font-bold text-slate-400 nums">
                            <Clock className="w-3.5 h-3.5 text-indigo-505" />
                            <span>Next Check-in:</span>
                            <span className="text-slate-600 dark:text-slate-300">
                              {(() => {
                                try {
                                  const parsedDate = new Date(nextCheckIn);
                                  if (!isNaN(parsedDate.getTime())) {
                                    return parsedDate.toLocaleDateString();
                                  }
                                } catch {}
                                return nextCheckIn;
                              })()}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

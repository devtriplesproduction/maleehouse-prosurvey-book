'use client';
// Force hot reload

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { submitEODAction } from '@/actions/eod.actions';
import { uploadEODPhotoAction } from '@/actions/storage.actions';
import { Send, Clock, AlertCircle, CheckCircle2, Camera, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PremiumDatePicker } from '@/components/ui/PremiumDatePicker';
import { SearchableSelect } from '@/components/ui/searchable-select';

interface EODReport {
  id: string;
  date: string;
  tasks_completed: string;
  hours_spent: number;
  blockers: string | null;
  work_location?: 'office' | 'field';
}

interface EODFormProps {
  reports?: EODReport[];
  allReports?: EODReport[];
  onSuccess?: () => void;
  staff?: any[];
  currentUserId?: string;
  currentUserRole?: string;
  hideHeader?: boolean;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerRightContent?: React.ReactNode;
}

// Dynamic Streak Calculation
function calculateStreak(reports: any[]) {
  if (!reports || reports.length === 0) return 0;

  // Extract just the YYYY-MM-DD part and sort
  const sorted = [...reports]
    .map((r: any) => r.date.split('T')[0])
    .sort((a: string, b: string) => a.localeCompare(b));

  // Get unique dates (in case of duplicates)
  const uniqueDates = Array.from(new Set(sorted));

  // Helper to get local date string YYYY-MM-DD
  const pad = (n: number) => n.toString().padStart(2, '0');
  const getLocalStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const now = new Date();
  const todayStr = getLocalStr(now);

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getLocalStr(yesterday);

  // Also account for "tomorrow" in case local time is behind DB time
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = getLocalStr(tomorrow);

  const lastIndex = uniqueDates.length - 1;
  const lastReportDateStr = uniqueDates[lastIndex];

  // If the last report is neither today, yesterday, nor tomorrow, the streak is broken
  if (lastReportDateStr !== todayStr && lastReportDateStr !== yesterdayStr && lastReportDateStr !== tomorrowStr) {
    return 0;
  }

  let streak = 0;
  // Parse last report date in local time to avoid timezone shifts
  const [y, m, d] = lastReportDateStr.split('-').map(Number);
  let checkDate = new Date(y, m - 1, d);

  // Go backwards and count consecutive days
  for (let i = lastIndex; i >= 0; i--) {
    const currentReportStr = uniqueDates[i];
    const expectedStr = getLocalStr(checkDate);

    if (currentReportStr === expectedStr) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

export function EODForm({ reports = [], allReports = [], onSuccess, staff, currentUserId, currentUserRole, hideHeader, title, subtitle, headerRightContent }: EODFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>('myself');
  // Fix: Use local time for dates to avoid UTC off-by-one errors
  const pad = (n: number) => n.toString().padStart(2, '0');
  const getLocalStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const [selectedDate, setSelectedDate] = useState<string>(getLocalStr(new Date()));
  const [photos, setPhotos] = useState<File[]>([]);

  const isSubmittingForOther = selectedUser !== 'myself';
  const canSelectDate = currentUserRole === 'admin' || currentUserRole === 'hr';
  let showLocationSelection = false;
  if (isSubmittingForOther) {
    const targetStaff = staff?.find((s: any) => s.id === selectedUser);
    const targetRole = (targetStaff?.department || targetStaff?.role || '').toLowerCase();
    showLocationSelection = targetRole === 'survey';
  } else {
    showLocationSelection = currentUserRole?.toLowerCase() === 'survey';
  }

  let targetReport = null;
  if (isSubmittingForOther) {
    targetReport = allReports.find((r: any) => r.date === selectedDate && r.user_id === selectedUser);
  } else {
    targetReport = reports.find((r: any) => r.date === selectedDate);
  }

  const hasSubmitted = !!targetReport;
  const streak = isSubmittingForOther ? 0 : calculateStreak(reports);

  const [formData, setFormData] = useState({
    tasks_completed: targetReport?.tasks_completed || '',
    hours_spent: targetReport?.hours_spent?.toString() || '',
    blockers: targetReport?.blockers || '',
    work_location: 'office' as 'office' | 'field'
  });

  // Update form data when target report changes
  useEffect(() => {
    if (targetReport) {
      setFormData({
        tasks_completed: targetReport.tasks_completed || '',
        hours_spent: targetReport.hours_spent?.toString() || '',
        blockers: targetReport.blockers || '',
        work_location: targetReport.work_location || 'office'
      });
    } else {
      setFormData({
        tasks_completed: '',
        hours_spent: '',
        blockers: '',
        work_location: 'office'
      });
    }
  }, [targetReport]);

  const pastDates = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return {
      value: getLocalStr(d),
      label: d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    };
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.tasks_completed.trim() || !formData.hours_spent) {
      toast.error('Please fill in completed tasks and office hours');
      return;
    }

    if (!/^\d+(\.\d{1,2})?$/.test(formData.hours_spent)) {
      toast.error('Office hours can have at most 2 decimal places');
      return;
    }

    if (parseFloat(formData.hours_spent) > 12) {
      toast.error('Office hours cannot exceed 12');
      return;
    }

    setLoading(true);
    try {
      let finalTasks = formData.tasks_completed.trim();

      if (photos.length > 0 && formData.work_location === 'field') {
        for (const pic of photos) {
          const uploadForm = new FormData();
          uploadForm.append('file', pic);
          const uploadRes = await uploadEODPhotoAction(uploadForm);
          if (!uploadRes.success) {
            toast.error(uploadRes.error || `Failed to upload photo: ${pic.name}`);
            setLoading(false);
            return;
          }
          finalTasks += `\n\n![Field Photo](${uploadRes.url})`;
        }
      }

      const response = await submitEODAction({
        tasks_completed: finalTasks,
        hours_spent: parseFloat(formData.hours_spent),
        blockers: formData.blockers.trim() || null,
        date: selectedDate,
        target_user_id: isSubmittingForOther ? selectedUser : undefined,
        work_location: formData.work_location
      });

      if (response.success) {
        toast.success(isSubmittingForOther ? 'EOD Report published on behalf of employee!' : 'EOD Report published successfully!');
        setFormData({
          tasks_completed: '',
          hours_spent: '',
          blockers: '',
          work_location: 'office'
        });
        setPhotos([]);
        if (onSuccess) onSuccess();
        router.refresh();
      } else {
        toast.error(response.error || 'Failed to submit report');
      }
    } catch(err) {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">

      {/* ── Form Card or Already Submitted Card ── */}
      {/* ── Form Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full"
      >
        {/* Submission Form Card */}
        <div className="border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40 p-5 md:p-6 rounded-2xl relative overflow-hidden">
          {hasSubmitted && (
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-indigo-500/20 via-indigo-500 to-indigo-500/20" />
          )}

          {staff && staff.length > 0 && (
            <div className="mb-6 pb-6 border-b border-slate-200/60 dark:border-white/5">
              <label className="text-xs font-black uppercase tracking-widest text-indigo-500 dark:text-indigo-400 flex items-center gap-1.5 mb-3">
                Submitting On Behalf Of
              </label>
              <SearchableSelect
                value={selectedUser}
                onValueChange={(val) => setSelectedUser(val)}
                options={[
                  { label: "Myself (Submit my own EOD)", value: "myself" },
                  ...staff
                    .filter((s: any) => s.id !== currentUserId && !(s.first_name === 'Admin' && s.last_name === 'System'))
                    .map((s: any) => ({
                      label: `${s.first_name} ${s.last_name} (${s.department || s.role})`,
                      value: s.id
                    }))
                ]}
                className="w-full md:w-80 h-11"
              />
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Tasks Completed */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    Tasks Accomplished Today <span className="text-indigo-500">*</span>
                  </label>

                </div>
                {hasSubmitted ? (
                  <div className="w-full h-32 overflow-y-auto rounded-2xl bg-slate-100 dark:bg-[#070b14]/50 border border-slate-200 dark:border-white/5 p-4 text-sm text-slate-900 dark:text-slate-100 opacity-75 cursor-not-allowed shadow-inner whitespace-pre-wrap leading-relaxed">
                    {(formData.tasks_completed || '').split(/!\[.*?\]\((.*?)\)/).map((part, index) => {
                      if (index % 2 === 1) {
                        return (
                          <div key={index} className="my-3">
                            <a href={part} target="_blank" rel="noopener noreferrer">
                              <img src={part} alt="Field Photo Attachment" className="max-w-48 h-auto rounded-xl border border-slate-200 dark:border-white/10 shadow-sm object-cover max-h-48 hover:opacity-90 transition-opacity" />
                            </a>
                          </div>
                        );
                      }
                      return <span key={index}>{part}</span>;
                    })}
                  </div>
                ) : (
                  <textarea
                    placeholder="Write the tasks you completed today"
                    value={formData.tasks_completed}
                    onChange={(e) => setFormData({ ...formData, tasks_completed: e.target.value })}
                    className="w-full h-32 rounded-2xl bg-slate-100 dark:bg-[#070b14]/50 border border-slate-200 dark:border-white/5 p-4 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/40 transition-all resize-none shadow-inner"
                    required
                  />
                )}
              </div>

              {/* Right Column: Blockers */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    Blockers / Impediments
                  </label>

                </div>
                <div className="relative h-32">
                  <AlertCircle className="absolute left-4 top-4 w-4 h-4 text-slate-400 pointer-events-none" />
                  <textarea
                    placeholder="List any blockers here..."
                    value={formData.blockers}
                    onChange={(e) => setFormData({ ...formData, blockers: e.target.value })}
                    disabled={hasSubmitted}
                    className="w-full h-full rounded-2xl bg-slate-100 dark:bg-[#070b14]/50 border border-slate-200 dark:border-white/5 pl-11 pr-4 py-4 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/40 transition-all resize-none shadow-inner disabled:opacity-75 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {formData.work_location === 'field' && (
              <div className="pt-2 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    Field Photo Attachments {photos.length > 0 && `(${photos.length})`}
                  </label>
                  {photos.length > 0 && !hasSubmitted && !loading && (
                    <button
                      type="button"
                      onClick={() => document.getElementById('field-photo-upload')?.click()}
                      className="text-xs font-bold text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add More Photos
                    </button>
                  )}
                </div>

                <input
                  id="field-photo-upload"
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const selected = Array.from(e.target.files || []);
                    if (selected.length > 0) {
                      setPhotos(prev => [...prev, ...selected]);
                      e.target.value = '';
                    }
                  }}
                  disabled={hasSubmitted}
                />

                {photos.length === 0 ? (
                  <div
                    onClick={() => !hasSubmitted && document.getElementById('field-photo-upload')?.click()}
                    className={cn(
                      "w-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center py-8 transition-all relative overflow-hidden",
                      hasSubmitted
                        ? "border-slate-200 dark:border-white/5 opacity-50 cursor-not-allowed bg-slate-50 dark:bg-[#070b14]/20"
                        : "border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10 cursor-pointer group"
                    )}
                  >
                    <div className="p-4 rounded-full bg-white dark:bg-[#070b14]/50 shadow-sm border border-slate-200 dark:border-white/5 mb-3 group-hover:scale-110 group-active:scale-95 transition-transform duration-200">
                      <Camera className="w-6 h-6 text-indigo-500" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Click to upload field photos (select multiple at once)
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                      JPG, PNG, WebP up to 10MB each
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
                      {photos.map((pic, idx) => (
                        <div key={`${pic.name}-${idx}`} className="glass-card p-3 border border-indigo-500/20 bg-indigo-500/5 flex items-center justify-between rounded-xl">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0 overflow-hidden relative">
                              {pic.type.startsWith('image/') ? (
                                <img src={URL.createObjectURL(pic)} alt="preview" className="w-full h-full object-cover" />
                              ) : (
                                <Camera className="w-5 h-5 text-indigo-500" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate pr-2">
                                {pic.name}
                              </p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                {(pic.size / (1024 * 1024)).toFixed(2)} MB
                              </p>
                            </div>
                          </div>
                          {!hasSubmitted && !loading && (
                            <button
                              type="button"
                              onClick={() => setPhotos(prev => prev.filter((_, i) => i !== idx))}
                              className="p-1.5 bg-white dark:bg-[#070b14]/50 hover:bg-rose-50 dark:hover:bg-rose-950/20 border border-slate-200 dark:border-white/5 rounded-full text-slate-400 hover:text-rose-500 transition-colors shrink-0 shadow-sm"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Bottom Row */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pt-5 border-t border-slate-200/60 dark:border-white/5">

              <div className="flex flex-col sm:flex-row gap-6 w-full md:w-auto">
                {/* Date Selection */}
                <div className="w-full sm:w-48 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      Report Date <span className="text-indigo-500">*</span>
                    </label>
                  </div>
                  <PremiumDatePicker
                    value={selectedDate}
                    onChange={setSelectedDate}
                    className="h-11"
                    disabled={!canSelectDate}
                  />
                </div>

                {/* Work Location */}
                {showLocationSelection && (
                  <div className="w-full sm:w-36 space-y-3">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      Location <span className="text-indigo-500">*</span>
                    </label>
                    <div className="relative group">
                      <select
                        value={formData.work_location}
                        onChange={(e) => setFormData({ ...formData, work_location: e.target.value as 'office' | 'field' })}
                        disabled={hasSubmitted}
                        className="w-full h-11 bg-slate-100 dark:bg-[#070b14]/50 border border-slate-200 dark:border-white/5 rounded-xl px-4 pr-10 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/40 transition-all appearance-none cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed shadow-inner font-semibold"
                      >
                        <option value="office">Office</option>
                        <option value="field">Field</option>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                      </div>
                    </div>
                  </div>
                )}

                {/* Office Hours */}
                <div className="w-full sm:w-48 space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    Office Hours <span className="text-indigo-500">*</span>
                  </label>
                  <div className="relative group">
                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors pointer-events-none" />
                    <input
                      type="number"
                      step="0.01"
                      max="12"
                      placeholder="8"
                      value={formData.hours_spent}
                      onChange={(e) => setFormData({ ...formData, hours_spent: e.target.value })}
                      disabled={hasSubmitted}
                      className="w-full h-11 bg-slate-100 dark:bg-[#070b14]/50 border border-slate-200 dark:border-white/5 rounded-xl pl-11 pr-4 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/40 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 no-spin shadow-inner font-semibold disabled:opacity-75 disabled:cursor-not-allowed"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Giant Submit Button */}
              <div className="w-full md:flex-1 md:max-w-md">
                <button
                  type="submit"
                  disabled={loading || hasSubmitted}
                  className={cn(
                    "w-full h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]",
                    hasSubmitted
                      ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 cursor-not-allowed"
                      : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 disabled:opacity-50 disabled:pointer-events-none"
                  )}
                >
                  {loading ? "Publishing..." : hasSubmitted ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-indigo-500" />
                      EOD Already Submitted
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Publish Daily EOD
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

'use client';

import React, { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  FileText, 
  Compass, 
  Layers, 
  ShieldCheck, 
  Upload, 
  X, 
  File as FileIcon, 
  CheckCircle2,
  Download,
  Trash2,
  Edit3,
  Search,
  Loader2,
  Image as ImageIcon,
  FolderOpen
} from 'lucide-react';
import { cn, downloadFile } from '@/lib/utils';
import { deleteFileAction, renameFileAction } from '@/actions/vault.actions';
import { registerFileAction } from '@/actions/file.actions';
import { uploadProjectFile } from '@/lib/supabase/storage';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface ProjectFile {
  id: string;
  file_name: string;
  category: string;
  file_url: string;
  storage_path: string;
  mime_type?: string;
  file_size?: number;
  uploaded_at: string;
}

interface DigitalVaultProps {
  projectId: string;
  files: ProjectFile[];
  userRole: string;
}

// Inner Tab structure
type VaultTab = 'documents' | 'field' | 'submission';

export function DigitalVault({ projectId, files, userRole }: DigitalVaultProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<VaultTab>('documents');
  const [searchTerm, setSearchTerm] = useState('');
  const [isPending, startTransition] = useTransition();

  const [localFiles, setLocalFiles] = useState<ProjectFile[]>(files);
  useEffect(() => {
    setLocalFiles(files);
  }, [files]);

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  
  // Dialog states
  const [renamingFile, setRenamingFile] = useState<ProjectFile | null>(null);
  const [newName, setNewName] = useState('');
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  const isAdmin = userRole === 'admin';
  const isEngineer = userRole === 'engineer';
  const isField = userRole === 'field';
  const isSales = userRole === 'sales';

  // Role check for uploads
  const canUploadToTab = (tab: VaultTab): boolean => {
    if (isAdmin || isEngineer) return true;
    if (tab === 'documents') return isSales;
    if (tab === 'field') return isField;
    return false;
  };

  // 1. Group Files by Tabs
  const getTabFiles = (tab: VaultTab) => {
    return localFiles.filter((f: any) => {
      const matchesSearch = f.file_name.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      switch (tab) {
        case 'documents':
          return ['requirements', 'receipt'].includes(f.category);
        case 'field':
          return ['survey_data', 'control_point_image', 'control_point_csv'].includes(f.category);
        case 'submission':
          return ['final_file'].includes(f.category);
        default:
          return false;
      }
    });
  };

  const currentTabFiles = getTabFiles(activeTab);

  // 2. Control Points Specific Check
  const cpImage = localFiles.find((f: any) => f.category === 'control_point_image');
  const cpCsv = localFiles.find((f: any) => f.category === 'control_point_csv');

  const cpStatus = (): { label: string; color: string; bg: string; border: string } => {
    if (cpImage && cpCsv) {
      return { label: '✓ Verified & Completed', color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
    }
    if (cpImage || cpCsv) {
      return { 
        label: `Partial: Missing ${!cpImage ? 'Image' : 'CSV'}`, 
        color: 'text-amber-500', 
        bg: 'bg-amber-500/10', 
        border: 'border-amber-500/20' 
      };
    }
    return { label: 'Pending Uploads', color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/20' };
  };

  // Actions
  const handleDelete = async (file: ProjectFile) => {
    if (!confirm('Are you sure you want to permanently delete this file?')) return;
    
    startTransition(async () => {
      const result = await deleteFileAction(file.id, projectId, file.storage_path);
      if (result?.success) {
        setLocalFiles(prev => prev.filter(f => f.id !== file.id));
        toast({ title: 'File Deleted', description: 'The file has been removed from the vault.', variant: 'success' });
      } else {
        toast({ title: 'Error', description: result?.error || 'Deletion failed', variant: 'error' });
      }
    });
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingFile || !newName) return;

    startTransition(async () => {
      const result = await renameFileAction(renamingFile.id, projectId, newName);
      if (result?.success) {
        if (result.data) {
          setLocalFiles(prev => prev.map(f => f.id === result.data.id ? result.data : f));
        }
        toast({ title: 'File Renamed', description: 'Vault record updated.', variant: 'success' });
        setRenamingFile(null);
      } else {
        toast({ title: 'Error', description: result?.error || 'Rename failed', variant: 'error' });
      }
    });
  };

  // Handle file uploads (General and Control Points)
  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>, targetCategory: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(10);
    setUploadError('');

    try {
      setUploadProgress(30);
      const uploadResult = await uploadProjectFile(file, projectId);
      setUploadProgress(70);

      const registerResult = await registerFileAction({
        project_id: projectId,
        category: targetCategory as any,
        file_name: uploadResult.fileName,
        file_url: uploadResult.publicUrl,
        mime_type: uploadResult.mimeType,
        file_size: uploadResult.fileSize,
        storage_bucket: 'project-assets',
      });

      if (!registerResult.success) {
        throw new Error(registerResult.error || 'Failed to register file in vault database');
      }

      setUploadProgress(100);
      toast({
        title: 'Upload Successful',
        description: `"${file.name}" has been synchronized with the Digital Vault.`,
        variant: 'success'
      });

      if (registerResult.data?.updated_project_stage) {
        toast({
          title: 'Workflow Rewound',
          description: `Project state updated to ${registerResult.data.updated_project_stage} to resume work.`,
          variant: 'default'
        });
      }

      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        router.refresh();
      }, 800);

    } catch (err: any) {
      console.error(err);
      setUploadError(err.message || 'Failed to upload resource.');
      setIsUploading(false);
      toast({
        title: 'Upload Failed',
        description: err.message || 'File upload failed.',
        variant: 'error'
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-emerald-500" />
            Digital Vault
          </h2>
          <p className="text-xs text-slate-400 mt-1">Project document collection and verification vault.</p>
        </div>

        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search vault files..." 
            className="flat-input pl-10 h-10 text-sm w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Sliding Vault Tabs */}
      <div className="relative p-1 bg-slate-100 dark:bg-slate-900/60 rounded-2xl flex gap-1 border border-slate-200/50 dark:border-white/5">
        {[
          { id: 'documents', label: 'Project Documents', icon: FileText },
          { id: 'field', label: 'Field Data', icon: Compass },
          { id: 'submission', label: 'Final Submissions', icon: ShieldCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id as VaultTab); setUploadError(''); }}
              className={cn(
                "relative flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-xs font-bold transition-all duration-300",
                isActive 
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200/40 dark:border-white/5" 
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
              )}
            >
              <Icon className={cn("w-4 h-4", isActive ? "text-indigo-500" : "text-slate-400")} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content panel */}
      <div className="space-y-6">
        
        {/* COMPULSORY CONTROL POINTS CARD - ONLY ON FIELD TAB */}
        {activeTab === 'field' && (
          <div className="p-6 rounded-3xl border border-indigo-500/20 bg-indigo-500/5 dark:bg-indigo-950/10 space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-500/10 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-xs font-black text-indigo-500 uppercase tracking-wider">Compulsory step</span>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Project Control Points</h3>
                </div>
                <p className="text-xs text-slate-400">
                  Field engineers are required to upload both the control point GPS image and data CSV file.
                </p>
              </div>
              
              <div className={cn("px-3.5 py-1.5 rounded-full text-xs font-black border uppercase tracking-wider self-start sm:self-center", cpStatus().bg, cpStatus().color, cpStatus().border)}>
                {cpStatus().label}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* IMAGE SLOT */}
              <div className={cn(
                "p-5 rounded-2xl border flex flex-col justify-between min-h-[140px] transition-all",
                cpImage ? "border-emerald-500/20 bg-emerald-500/[0.02]" : "border-slate-200 dark:border-white/10"
              )}>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-400">Control Points Image</span>
                    {cpImage && <span className="text-xs font-bold text-emerald-500 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Uploaded</span>}
                  </div>
                  
                  {cpImage ? (
                    <div className="flex flex-col gap-3">
                      <div className="relative w-full h-32 rounded-lg overflow-hidden border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
                        <img 
                          src={cpImage.file_url} 
                          alt={cpImage.file_name} 
                          className="w-full h-full object-cover cursor-zoom-in hover:scale-105 transition-transform duration-300"
                          onClick={() => setSelectedImageUrl(cpImage.file_url)}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{cpImage.file_name}</p>
                        <p className="text-xs text-slate-400 font-bold uppercase">{cpImage.file_size ? `${(cpImage.file_size / 1024).toFixed(1)} KB` : 'IMAGE'}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 leading-normal">
                      Upload the photographic reference showing benchmark markings or DGPS monument alignment.
                    </p>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-white/5 pt-3">
                  {cpImage ? (
                    <>
                      <button 
                        onClick={(e) => { e.preventDefault(); downloadFile(cpImage.file_url, cpImage.file_name); }}
                        className="px-3.5 py-1.5 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-xs font-bold text-slate-700 dark:text-slate-200 transition-all flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" /> Download
                      </button>
                      {(canUploadToTab('field') || isAdmin) && (
                        <button 
                          disabled={isPending}
                          onClick={() => handleDelete(cpImage)}
                          className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-500 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  ) : (
                    canUploadToTab('field') && (
                      <label className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5 cursor-pointer hover:-translate-y-0.5 active:translate-y-0">
                        <Upload className="w-3.5 h-3.5" /> Upload Image
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => handleUpload(e, 'control_point_image')}
                          disabled={isUploading}
                        />
                      </label>
                    )
                  )}
                </div>
              </div>

              {/* CSV SLOT */}
              <div className={cn(
                "p-5 rounded-2xl border flex flex-col justify-between min-h-[140px] transition-all",
                cpCsv ? "border-emerald-500/20 bg-emerald-500/[0.02]" : "border-slate-200 dark:border-white/10"
              )}>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-400">Control Points Coordinates (CSV)</span>
                    {cpCsv && <span className="text-xs font-bold text-emerald-500 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Uploaded</span>}
                  </div>
                  
                  {cpCsv ? (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                        <FileIcon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{cpCsv.file_name}</p>
                        <p className="text-xs text-slate-400 font-bold uppercase">{cpCsv.file_size ? `${(cpCsv.file_size / 1024).toFixed(1)} KB` : 'CSV'}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 leading-normal">
                      Upload the CSV data grid showing exact coordinates, elevations, and ID parameters of all control markers.
                    </p>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-white/5 pt-3">
                  {cpCsv ? (
                    <>
                      <button 
                        onClick={(e) => { e.preventDefault(); downloadFile(cpCsv.file_url, cpCsv.file_name); }}
                        className="px-3.5 py-1.5 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-xs font-bold text-slate-700 dark:text-slate-200 transition-all flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" /> Download
                      </button>
                      {(canUploadToTab('field') || isAdmin) && (
                        <button 
                          disabled={isPending}
                          onClick={() => handleDelete(cpCsv)}
                          className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-500 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  ) : (
                    canUploadToTab('field') && (
                      <label className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5 cursor-pointer hover:-translate-y-0.5 active:translate-y-0">
                        <Upload className="w-3.5 h-3.5" /> Upload CSV
                        <input 
                          type="file" 
                          accept=".csv,text/csv" 
                          className="hidden" 
                          onChange={(e) => handleUpload(e, 'control_point_csv')}
                          disabled={isUploading}
                        />
                      </label>
                    )
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* UPLOADING STATE INDICATOR */}
        {isUploading && (
          <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" /> Uploading to Digital Vault...
              </span>
              <span className="nums font-bold text-indigo-500">{uploadProgress}%</span>
            </div>
            <div className="w-full h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-500 transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* DIRECT UPLOADER BOX - FOR GENERAL CATEGORIES */}
        {canUploadToTab(activeTab) && !isUploading && (
          <div className="p-6 rounded-2xl border border-dashed border-slate-200 dark:border-white/10 flex flex-col items-center justify-center gap-3 text-center bg-slate-50/40 dark:bg-transparent">
            <div className="p-3 bg-indigo-500/10 rounded-full text-indigo-500">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Upload to this category</p>
              <p className="text-xs text-slate-400 mt-1">Select blueprints, data, drawings, or reports</p>
            </div>
            <label className="px-4 py-2 rounded-xl bg-slate-800 dark:bg-white/5 hover:bg-slate-700 dark:hover:bg-white/10 text-xs font-bold text-white dark:text-slate-200 transition-all flex items-center gap-1.5 cursor-pointer border border-transparent dark:border-white/10">
              Choose File
              <input 
                type="file" 
                className="hidden" 
                onChange={(e) => {
                  const catMap: Record<VaultTab, string> = {
                    documents: 'requirements',
                    field: 'survey_data',
                    submission: 'final_file'
                  };
                  handleUpload(e, catMap[activeTab]);
                }}
              />
            </label>
          </div>
        )}

        {/* FILES LISTING VIEW */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                   {currentTabFiles.map((file) => {
            // Determine file icon
            const isImage = file.mime_type?.startsWith('image/') || ['control_point_image'].includes(file.category);
            const isDoc = ['receipt', 'requirements'].includes(file.category);
            const Icon = isImage ? ImageIcon : isDoc ? FileText : FileIcon;
            
            return (
              <div 
                key={file.id} 
                className="group relative glass-card p-4 border-slate-200/60 dark:border-white/10 hover:border-indigo-500/30 transition-all flex flex-col justify-between min-h-[140px]"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center shrink-0", 
                      isImage ? "bg-emerald-500/10 text-emerald-500" : isDoc ? "bg-blue-500/10 text-blue-500" : "bg-purple-500/10 text-purple-500"
                    )}>
                      <Icon className="w-4 h-4" />
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => { e.preventDefault(); downloadFile(file.file_url, file.file_name); }}
                        className="p-1.5 rounded bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 transition-all"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      {(isAdmin || userRole === 'engineer') && (
                        <button 
                          onClick={() => { setRenamingFile(file); setNewName(file.file_name); }}
                          className="p-1.5 rounded bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 transition-all"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {(isAdmin || userRole === 'engineer') && (
                        <button 
                          onClick={() => handleDelete(file)}
                          className="p-1.5 rounded bg-slate-100 dark:bg-white/5 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-500 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {isImage && (
                    <div className="relative w-full h-24 rounded-lg overflow-hidden border border-slate-200 dark:border-white/10 mb-3 bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
                      <img 
                        src={file.file_url} 
                        alt={file.file_name} 
                        className="w-full h-full object-cover cursor-zoom-in hover:scale-105 transition-transform duration-300"
                        onClick={() => setSelectedImageUrl(file.file_url)}
                      />
                    </div>
                  )}

                  <div className="mt-2">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate" title={file.file_name}>
                      {file.file_name}
                    </h4>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                      {file.category.replace('_', ' ')}
                    </p>
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-white/5 pt-2 mt-3 flex items-center justify-between text-xs font-medium text-slate-400">
                  <span>{file.file_size ? `${(file.file_size / 1024).toFixed(1)} KB` : '1 MB'}</span>
                  <span>{new Date(file.uploaded_at).toLocaleDateString()}</span>
                </div>
              </div>
            );
          })}

          {currentTabFiles.length === 0 && (
            <div className="col-span-full py-12 flex flex-col items-center justify-center text-center">
              <FolderOpen className="w-10 h-10 text-slate-200 dark:text-slate-700 mb-2" />
              <p className="text-xs text-slate-400 font-bold">No files uploaded in this folder</p>
            </div>
          )}

        </div>

      </div>

      {/* Rename Dialog */}
      <Dialog open={!!renamingFile} onOpenChange={(open) => !open && setRenamingFile(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename Vault Item</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRename} className="space-y-4 pt-2">
            <input 
              type="text" 
              className="flat-input h-10 text-sm font-bold w-full"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
            <DialogFooter>
              <button 
                type="submit" 
                disabled={isPending}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white transition-all flex items-center justify-center gap-1"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm Rename
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Image Lightbox Dialog */}
      <Dialog open={!!selectedImageUrl} onOpenChange={(open) => !open && setSelectedImageUrl(null)}>
        <DialogContent className="max-w-3xl p-1 bg-black/90 overflow-hidden border-none rounded-2xl flex items-center justify-center">
          <div className="relative w-full h-full max-h-[80vh] flex items-center justify-center p-4">
            {selectedImageUrl && (
              <img 
                src={selectedImageUrl} 
                alt="Vault Asset Preview" 
                className="max-w-full max-h-[75vh] object-contain rounded-lg"
              />
            )}
            <button 
              onClick={() => setSelectedImageUrl(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/60 text-white hover:bg-black/85 transition-all border border-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

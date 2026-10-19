'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Folder, 
  Lock, 
  ChevronRight, 
  ArrowLeft, 
  Upload, 
  Download, 
  Trash2, 
  Edit3, 
  FileText, 
  File as FileIcon, 
  Image as ImageIcon,
  Loader2,
  X,
  FolderOpen,
  Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { deleteFileAction, renameFileAction } from '@/actions/vault.actions';
import { registerFileAction } from '@/actions/file.actions';
import { uploadProjectFile } from '@/lib/supabase/storage';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface ProjectFile {
  id: string;
  file_name: string;
  category: string;
  file_url: string;
  storage_path: string;
  mime_type?: string;
  file_size?: number;
  uploaded_at: string;
  version?: number;
}

interface ProjectDocumentsTabProps {
  projectId: string;
  files: ProjectFile[];
  userRole: string;
  onUpdateFiles?: (updatedFiles: ProjectFile[]) => void;
}

interface FolderConfig {
  id: string;
  name: string;
  description: string;
  allowedRoles: string[];
  categories: string[];
  defaultCategory: string;
}

const FOLDERS: FolderConfig[] = [
  {
    id: 'client_docs',
    name: 'Client Documents',
    description: 'Project briefs, coordinate guidelines, requirements lists, and intake files.',
    allowedRoles: ['admin', 'accountant', 'engineer', 'sales'],
    categories: ['requirements', 'intake_document'],
    defaultCategory: 'requirements'
  },
  {
    id: 'survey_data',
    name: 'Survey Data',
    description: 'Raw survey coordinates, field logs, site photos, DGPS details, and control point CSVs.',
    allowedRoles: ['admin', 'field', 'engineer'],
    categories: ['survey_data', 'site_photo', 'field_report', 'control_point_image', 'control_point_csv'],
    defaultCategory: 'survey_data'
  },
  {
    id: 'qc_reports',
    name: 'QC Reports',
    description: 'Quality checklists, validation logs, field audits, and QC audit reports.',
    allowedRoles: ['admin', 'engineer'],
    categories: ['qc_report'],
    defaultCategory: 'qc_report'
  },
  {
    id: 'final_deliverables',
    name: 'Final Deliverables',
    description: 'Final signed blueprints, verified client-ready drawings, and finalized layouts.',
    allowedRoles: ['admin', 'engineer'],
    categories: ['final_file'],
    defaultCategory: 'final_file'
  },
  {
    id: 'invoices',
    name: 'Invoices & Receipts',
    description: 'GST professional invoices, fee breakdown sheets, and bank transfer receipts.',
    allowedRoles: ['admin', 'accountant'],
    categories: ['receipt', 'invoice'],
    defaultCategory: 'receipt'
  }
];

export default function ProjectDocumentsTab({
  projectId,
  files,
  userRole,
  onUpdateFiles
}: ProjectDocumentsTabProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Dialog states
  const [renamingFile, setRenamingFile] = useState<ProjectFile | null>(null);
  const [newName, setNewName] = useState('');
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  const activeFolder = FOLDERS.find((f: any) => f.id === activeFolderId);
  const isAdmin = userRole === 'admin';
  const isEngineer = userRole === 'engineer';

  // Check upload permission for a folder
  const canUploadToFolder = (folder: FolderConfig) => {
    return isAdmin || isEngineer || folder.allowedRoles.includes(userRole);
  };

  // Filter files in the active folder
  const currentFolderFiles = activeFolder
    ? files.filter((f: any) => activeFolder.categories.includes(f.category))
    : [];

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeFolder) return;
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(10);

    try {
      setUploadProgress(40);
      const uploadResult = await uploadProjectFile(file, projectId);
      setUploadProgress(70);

      const registerResult = await registerFileAction({
        project_id: projectId,
        category: activeFolder.defaultCategory as any,
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
        description: `"${file.name}" uploaded to ${activeFolder.name}.`,
        variant: 'success'
      });

      if (registerResult.data?.updated_project_stage) {
        toast({
          title: 'Workflow Rewound',
          description: `Project state updated to ${registerResult.data.updated_project_stage} to resume work.`,
          variant: 'default'
        });
        router.refresh();
      }

      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        if (onUpdateFiles && registerResult.data) {
          onUpdateFiles([registerResult.data, ...files]);
        }
      }, 600);

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

  const handleDelete = async (file: ProjectFile) => {
    if (!confirm('Are you sure you want to delete this file permanently?')) return;
    
    startTransition(async () => {
      const result = await deleteFileAction(file.id, projectId, file.storage_path);
      if (result?.success) {
        toast({ title: 'File Deleted', description: 'Removed from vault folder successfully.', variant: 'success' });
        if (onUpdateFiles) {
          onUpdateFiles(files.filter(f => f.id !== file.id));
        }
      } else {
        toast({ title: 'Delete Failed', description: result?.error || 'Unable to delete', variant: 'error' });
      }
    });
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingFile || !newName) return;

    startTransition(async () => {
      const result = await renameFileAction(renamingFile.id, projectId, newName);
      if (result?.success) {
        toast({ title: 'File Renamed', description: 'File name successfully updated.', variant: 'success' });
        setRenamingFile(null);
        if (onUpdateFiles && result.data) {
          onUpdateFiles(files.map(f => f.id === renamingFile.id ? result.data : f));
        }
      } else {
        toast({ title: 'Rename Failed', description: result?.error || 'Rename failed', variant: 'error' });
      }
    });
  };

  return (
    <div className="space-y-6">
      
      <AnimatePresence mode="wait">
        {!activeFolderId ? (
          
          /* FOLDER DIRECTORY VIEW */
          <motion.div
            key="folders"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {FOLDERS.map((folder) => {
              const allowed = canUploadToFolder(folder);
              const folderFilesCount = files.filter((f: any) => folder.categories.includes(f.category)).length;

              return (
                <div
                  key={folder.id}
                  onClick={() => setActiveFolderId(folder.id)}
                  className="group relative glass-card p-6 border-slate-200 dark:border-white/10 hover:border-indigo-500/30 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between min-h-[170px]"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className={cn(
                        "w-11 h-11 rounded-2xl flex items-center justify-center transition-all",
                        allowed 
                          ? "bg-indigo-500/10 text-indigo-500 group-hover:scale-105" 
                          : "bg-slate-100 dark:bg-white/5 text-slate-400"
                      )}>
                        <Folder className="w-5 h-5 fill-current" />
                      </div>
                      {!allowed && (
                        <div className="flex items-center gap-1 text-xs font-bold tracking-widest text-slate-400 bg-slate-100 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 px-2 py-0.5 rounded-md">
                          <Lock className="w-2.5 h-2.5" /> Locked
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5">
                        {folder.name}
                      </h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400 leading-normal mt-1">
                        {folder.description}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 dark:border-white/5 pt-3 mt-4 flex items-center justify-between text-xs font-bold tracking-wider text-slate-400">
                    <span>{folderFilesCount} Files</span>
                    <span className="text-indigo-500 group-hover:translate-x-1 transition-transform flex items-center gap-0.5">
                      Open Folder <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </motion.div>

        ) : (
          
          /* ACTIVE FOLDER VIEW */
          <motion.div
            key="folder-files"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Active Folder Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 dark:border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveFolderId(null)}
                  className="p-2 rounded-xl border border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-all flex items-center justify-center shrink-0"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-wider">{activeFolder?.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{activeFolder?.description}</p>
                </div>
              </div>

              {activeFolder && canUploadToFolder(activeFolder) && !isUploading && (
                <label className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5 cursor-pointer self-start sm:self-center">
                  <Upload className="w-4 h-4" /> Upload Resource
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleUpload}
                  />
                </label>
              )}
            </div>

            {/* Uploading progress indicator */}
            {isUploading && (
              <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-bold tracking-wider flex items-center gap-1.5">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-500" /> Secure Storage Upload...
                  </span>
                  <span className="nums font-bold text-indigo-500">{uploadProgress}%</span>
                </div>
                <div className="w-full h-1 bg-slate-150 dark:bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Active Lock Banner if restricted */}
            {activeFolder && !canUploadToFolder(activeFolder) && (
              <div className="p-4 rounded-2xl border border-rose-500/10 bg-rose-500/5 text-rose-500 flex items-center gap-3 text-xs font-medium">
                <Lock className="w-4 h-4 shrink-0" />
                <span>You do not have write access to this vault folder. Upload restricted to authorized departments.</span>
              </div>
            )}

            {/* Files list */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {currentFolderFiles.map((file) => {
                const isImage = file.mime_type?.startsWith('image/') || ['control_point_image', 'site_photo'].includes(file.category);
                const isDoc = ['receipt', 'requirements'].includes(file.category);
                const Icon = isImage ? ImageIcon : isDoc ? FileText : FileIcon;

                return (
                  <div
                    key={file.id}
                    className="group relative glass-card p-4 border-slate-200 dark:border-white/10 hover:border-indigo-500/30 transition-all flex flex-col justify-between min-h-[140px]"
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
                          <a
                            href={file.file_url}
                            target="_blank"
                            rel="noreferrer noopener"
                            title="Preview"
                            className="p-1.5 rounded bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 transition-all"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </a>
                          <a
                            href={file.file_url}
                            download={file.file_name}
                            title="Download"
                            className="p-1.5 rounded bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 transition-all"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
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
                        <div className="relative w-full h-24 rounded-lg overflow-hidden border border-slate-250 dark:border-white/5 mb-3 bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
                          <img
                            src={file.file_url}
                            alt={file.file_name}
                            className="w-full h-full object-cover cursor-zoom-in hover:scale-105 transition-transform duration-300"
                            onClick={() => setSelectedImageUrl(file.file_url)}
                          />
                        </div>
                      )}

                      <div className="mt-2">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate" title={file.file_name}>
                            {file.file_name}
                          </h4>
                          {(file.version ?? 1) > 1 && (
                            <span className="text-[9px] font-black px-1 py-0.5 rounded-sm bg-indigo-500/10 text-indigo-500 flex-shrink-0">
                              v{file.version}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 font-bold tracking-wider mt-0.5">
                          {file.category.replace('_', ' ')}
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 dark:border-white/5 pt-2 mt-3 flex items-center justify-between text-xs font-medium text-slate-400">
                      <span>{file.file_size ? `${(file.file_size / 1024).toFixed(1)} KB` : 'N/A'}</span>
                      <span>{new Date(file.uploaded_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}

              {currentFolderFiles.length === 0 && (
                <div className="col-span-full py-12 flex flex-col items-center justify-center text-center">
                  <FolderOpen className="w-10 h-10 text-slate-200 dark:text-slate-800 mb-2" />
                  <p className="text-xs text-slate-400 font-bold">This folder is currently empty.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rename Dialog */}
      <Dialog open={!!renamingFile} onOpenChange={(open) => !open && setRenamingFile(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename Vault File</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRename} className="space-y-4 pt-2">
            <input
              type="text"
              required
              className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-xs font-bold text-slate-200"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
            <DialogFooter>
              <button
                type="submit"
                disabled={isPending}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white transition-all flex items-center justify-center gap-1.5"
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
        <DialogContent className="max-w-3xl p-1 bg-black/95 overflow-hidden border-none rounded-2xl flex items-center justify-center">
          <div className="relative w-full h-full max-h-[80vh] flex items-center justify-center p-4">
            {selectedImageUrl && (
              <img
                src={selectedImageUrl}
                alt="Vault Image Preview"
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

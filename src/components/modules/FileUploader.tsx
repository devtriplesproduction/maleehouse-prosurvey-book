'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, X, File as FileIcon, CheckCircle2, AlertCircle, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { uploadProjectFile } from '@/lib/supabase/storage';
import { registerFileAction } from '@/actions/file.actions';
import { useToast } from '@/hooks/use-toast';
import { useUploadStore } from '@/store/useUploadStore';

interface FileUploaderProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FileUploader({ projectId, open, onOpenChange }: FileUploaderProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState<'receipt' | 'requirements' | 'survey_data' | 'final_file'>('requirements');
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const { startUpload, updateProgress, completeUpload, failUpload } = useUploadStore();

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files || []);
    if (droppedFiles.length > 0) {
      setFiles(prev => [...prev, ...droppedFiles]);
    }
  }, []);

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      setFiles(prev => [...prev, ...selectedFiles]);
      e.target.value = '';
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setIsUploading(true);
    setStatus('uploading');
    setProgress(5);

    let hasRewound = false;
    let rewoundStage = '';
    let successCount = 0;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const uploadId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
        
        // Register in global monitor
        startUpload(uploadId, file.name);
        const baseProgress = Math.round((i / files.length) * 100);
        setProgress(Math.min(95, baseProgress + 10));
        updateProgress(uploadId, 25);

        // 1. Upload to Supabase Storage
        const uploadResult = await uploadProjectFile(file, projectId);
        updateProgress(uploadId, 70);

        // 2. Register metadata in database
        const registerResult = await registerFileAction({
          project_id: projectId,
          category,
          file_name: uploadResult.fileName,
          file_url: uploadResult.publicUrl,
          mime_type: uploadResult.mimeType,
          file_size: uploadResult.fileSize,
          storage_bucket: 'project-assets',
        });

        if (!registerResult.success) {
          failUpload(uploadId);
          throw new Error(registerResult.error || `Failed to register ${file.name}`);
        }

        updateProgress(uploadId, 100);
        completeUpload(uploadId);
        successCount++;

        if (registerResult.data?.updated_project_stage) {
          hasRewound = true;
          rewoundStage = registerResult.data.updated_project_stage;
        }
      }

      setProgress(100);
      setStatus('success');
      toast({
        title: "Resources uploaded successfully",
        description: files.length === 1
          ? `${files[0].name} is now available in project assets.`
          : `${files.length} files are now available in project assets.`,
        variant: "success"
      });

      if (hasRewound) {
        toast({
          title: "Workflow Rewound",
          description: `Project state updated to ${rewoundStage} to resume work.`,
          variant: "default"
        });
      }

      setTimeout(() => {
        onOpenChange(false);
        setFiles([]);
        setStatus('idle');
        setProgress(0);
        router.refresh();
      }, 1000);

    } catch (error: any) {
      console.error('Upload failed:', error);
      setStatus('error');
      setErrorMessage(error.message || 'Failed to upload files.');
      toast({
        title: "Upload Interrupted",
        description: error.message || "Failed to synchronize files with storage network.",
        variant: "error"
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!isUploading) {
        if (!val) setFiles([]);
        onOpenChange(val);
      }
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Project Files</DialogTitle>
        </DialogHeader>

        <div className="p-6 space-y-6">
          {/* Category Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">File Category</label>
            <select 
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              disabled={isUploading}
            >
              <option value="requirements">Project Requirements</option>
              <option value="survey_data">Survey Data</option>
              <option value="receipt">Receipt</option>
              <option value="final_file">Final Deliverable</option>
            </select>
          </div>

          {/* Hidden multi-file input */}
          <input 
            id="file-input"
            type="file" 
            multiple
            className="hidden" 
            accept=".pdf,image/*,.csv,text/csv,.kml,.dwg"
            onChange={onFileSelect}
            disabled={isUploading}
          />

          {/* Drag and Drop Zone */}
          {files.length === 0 ? (
            <div 
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              className="border-2 border-dashed border-white/10 rounded-2xl p-10 flex flex-col items-center justify-center gap-3 hover:bg-white/5 transition-all cursor-pointer relative"
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <div className="p-4 bg-indigo-500/10 rounded-full text-indigo-500">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium">Drag & drop or click to upload</p>
              <p className="text-xs text-gray-500 text-center">Support for multiple files: Blueprints, PDF, Images, CSV, KML, and DWG</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Selected Files ({files.length})
                </span>
                {!isUploading && (
                  <button
                    type="button"
                    onClick={() => document.getElementById('file-input')?.click()}
                    className="text-xs font-bold text-indigo-500 hover:text-indigo-400 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add More
                  </button>
                )}
              </div>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {files.map((file, idx) => (
                  <div key={`${file.name}-${idx}`} className="glass-card p-3 border-white/10 flex items-center justify-between animate-in zoom-in-95 duration-200">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 bg-white/5 rounded-lg shrink-0">
                        <FileIcon className="w-4 h-4 text-gray-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate max-w-[200px]">{file.name}</p>
                        <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(2)} KB</p>
                      </div>
                    </div>
                    {!isUploading && (
                      <button 
                        type="button" 
                        onClick={() => removeFile(idx)} 
                        className="p-1 hover:bg-white/10 rounded-full transition-all text-gray-500 hover:text-rose-500"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Progress / Status */}
          {status === 'uploading' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Uploading to project-assets...</span>
                <span className="nums font-bold text-indigo-500">{progress}%</span>
              </div>
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {status === 'success' && (
            <div className="flex items-center justify-center gap-2 text-green-500 py-2 animate-in fade-in slide-in-from-bottom-2">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm font-medium">Upload Complete!</span>
            </div>
          )}

          {status === 'error' && (
            <div className="flex items-center gap-2 text-red-500 bg-red-500/10 p-3 rounded-xl animate-in shake duration-300">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="text-xs font-medium">{errorMessage}</span>
            </div>
          )}

          {/* Action Button */}
          <button
            onClick={handleUpload}
            disabled={files.length === 0 || isUploading || status === 'success'}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0"
          >
            {isUploading 
              ? `Uploading ${files.length} file${files.length > 1 ? 's' : ''}...` 
              : status === 'success' 
              ? 'Finished' 
              : files.length > 1 
              ? `Upload ${files.length} Files` 
              : 'Start Upload'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

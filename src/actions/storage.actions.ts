'use server';

import { normalizeData } from '@/lib/normalize';

import { checkActionRateLimit } from '@/lib/rate-limit';

import { createClient } from '@/lib/supabase/server';
import { verifyProjectAccess, type Role } from '@/lib/permissions/permissions';
import { requireAuthContext } from '@/lib/permissions/access-control';
import { getUserProfileAction } from '@/actions/auth.actions';

export async function uploadFileToServerAction(
  formData: FormData,
  projectId: string,
  bucket: string = 'project-assets'
) {
  try {
    const file = formData.get('file') as File;
    if (!file) throw new Error('No file provided');

    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    const ALLOWED_EXTENSIONS = [
      'jpg', 'jpeg', 'png', 'webp', 'gif', 'svg',
      'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'rtf',
      'zip', 'rar', '7z', 'tar', 'gz',
      'dwg', 'dxf', 'rvt', 'skp', 'kml', 'kmz'
    ];

    const fileExt = file.name.split('.').pop()?.toLowerCase() || '';

    if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
      return { success: false, error: "Invalid file type. Please upload a supported document, image, drawing, or archive format." };
    }

    if (file.size > MAX_FILE_SIZE) {
      return { success: false, error: "File exceeds the 50MB maximum size limit." };
    }

    const supabase = await createClient();

    // 1. Auth & Profile Check
    const { userId, role, error: authError } = await requireAuthContext();
    if (authError || !userId) return { success: false, error: "Unauthorized. Please log in to upload files." };
    
    if (!(await checkActionRateLimit(userId, 'uploadFileToServerAction', 100, 60 * 1000))) {
      return { success: false, error: 'Rate limit exceeded for this action. Please try again later.' };
    }

    // 2. Assignment Check
    if (projectId === 'company-wide') {
      if (role !== 'admin' && role !== 'accountant') {
        return { success: false, error: "Permission denied for company-wide uploads." };
      }
    } else {
      const accessCheck = await verifyProjectAccess(projectId, userId, role as Role, true);
      if (!accessCheck.isAllowed) {
        return { success: false, error: accessCheck.error || "Permission denied." };
      }
    }

    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
    const filePath = `${projectId}/${fileName}`;

    // Upload using standard Client - relies on Storage RLS
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file);

    if (error) {
      throw error;
    }

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return {
      success: true,
      data: {
        path: data.path,
        publicUrl
      }
    };
  } catch (error: any) {
    console.error('File upload error:', error);
    return { success: false, error: error.message };
  }
}

export async function uploadEODPhotoAction(formData: FormData) {
  try {
    const file = formData.get('file') as File;
    if (!file) throw new Error('No file provided');

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB for EOD photos
    if (file.size > MAX_FILE_SIZE) {
      return { success: false, error: "Photo exceeds 10MB limit." };
    }

    const profile: any = await getUserProfileAction();
    if (!profile) {
       return { success: false, error: 'Unauthorized to upload EOD photos.' };
    }

    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${profile.id}/${timestamp}_${safeName}`;

    const supabase = await createClient();

    const { error: uploadError } = await supabase
      .storage
      .from('eod-photos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase
      .storage
      .from('eod-photos')
      .getPublicUrl(filePath);

    return { success: true, url: publicUrl, path: filePath };
  } catch (error: any) {
    console.error('EOD Photo Upload error:', error);
    return { success: false, error: error.message };
  }
}


export async function uploadHRDocumentAction(
  formData: FormData,
  employeeId: string,
  category: string
) {
  try {
    const file = formData.get('file') as File;
    if (!file) throw new Error('No file provided');

    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return { success: false, error: "File exceeds 50MB limit." };
    }

    const profile: any = await getUserProfileAction();
    
    if (profile?.role !== 'admin' && profile?.role !== 'hr') {
       return { success: false, error: 'Unauthorized to upload HR documents.' };
    }

    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${employeeId}/${timestamp}_${safeName}`;

    const supabase = await createClient();

    const { error: uploadError } = await supabase
      .storage
      .from('hr-documents') 
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase
      .storage
      .from('hr-documents')
      .getPublicUrl(filePath);

    // Save to employee_documents table
    const { error: dbError } = await supabase
      .from('employee_documents')
      .insert({
        employee_id: employeeId,
        category: category,
        file_url: publicUrl,
        uploaded_by: profile.id,
      } as any);

    if (dbError) throw dbError;

    return { success: true, url: publicUrl, path: filePath };
  } catch (error: any) {
    console.error('HR Upload error:', error);
    return { success: false, error: error.message };
  }
}

export async function getEmployeeDocumentsAction(employeeId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('employee_documents')
      .select('*, uploaded_by_profile:profiles!uploaded_by(first_name, last_name)')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data: normalizeData(data) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

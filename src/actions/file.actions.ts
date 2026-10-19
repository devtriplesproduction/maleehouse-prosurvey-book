'use server';

import { normalizeData } from '@/lib/normalize';

import { checkActionRateLimit } from '@/lib/rate-limit';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { registerFileSchema, type RegisterFileInput } from '@/validations/file.schema';
import type { ActionResponse } from './project.actions';
import { getUserProfileAction } from './auth.actions';
import { verifyProjectAccess, type Role } from '@/lib/permissions/permissions';
import { notifySupplementalUploadAction } from './notification.actions';
import { logWorkflowAudit } from "@/lib/workflow/logWorkflowAudit";
import { getTemplateConfig, getRewindStageForCategory } from "@/lib/workflow-engine";
import { transitionWorkflowAction } from "./workflow.actions";

export async function registerFileAction(payload: RegisterFileInput): Promise<ActionResponse> {
  try {
    const validatedFields = registerFileSchema.safeParse(payload);

    if (!validatedFields.success) {
      return {
        success: false,
        error: validatedFields.error.errors[0]?.message || 'Validation failed.'
      };
    }
    const profile: any = await getUserProfileAction();
    if (!profile || !profile.id) {
      return { success: false, error: 'Unauthorized. Please log in to upload files.' };
    }
    const userId = profile.id;

    const supabase: any = await createClient();

    const role = profile.role || "";
    const accessCheck = await verifyProjectAccess(validatedFields.data.project_id, userId, role as Role, true);
    if (!accessCheck.isAllowed) {
      return { success: false, error: accessCheck.error || "Permission denied." };
    }

    // 1. Enforce Freeze and Payment Holds & Fetch Status
    const { data: project } = await supabase
      .from('projects')
      .select('status, is_frozen, workflow_type')
      .eq('id', validatedFields.data.project_id)
      .single();

    if (project?.is_frozen) {
      return {
        success: false,
        error: "Upload Blocked: Project operations are frozen due to outstanding payments."
      };
    }

    const categoryFolders: Record<string, string> = {
      receipt: 'receipt',
      requirements: 'requirements',
      survey_data: 'field-data',
      control_point_image: 'field-data',
      control_point_csv: 'field-data',
      final_file: 'deliverables'
    };
    const folder = categoryFolders[validatedFields.data.category] || 'misc';
    const enforcedPath = `${validatedFields.data.project_id}/${folder}/${validatedFields.data.file_name}`;

    const newFileRecord = {
      id: crypto.randomUUID(),
      project_id: validatedFields.data.project_id,
      category: validatedFields.data.category,
      file_name: validatedFields.data.file_name,
      file_url: validatedFields.data.file_url || '',
      mime_type: validatedFields.data.mime_type || 'application/pdf',
      file_size_bytes: validatedFields.data.file_size || 1024,
      uploaded_by: userId,
      uploaded_at: new Date().toISOString(),
    };

    const { data: insertedFile, error: insertError } = await supabase
      .from('files')
      .insert(newFileRecord)
      .select()
      .single();

    if (insertError) {
      return { success: false, error: insertError.message };
    }

    await logWorkflowAudit(supabase, validatedFields.data.project_id, userId, `Uploaded file: ${validatedFields.data.file_name} (${validatedFields.data.category})`);

    await supabase.from("activity_logs").insert({
      project_id: validatedFields.data.project_id,
      user_id: userId,
      action: "FILE_UPLOADED",
      details: { file_name: validatedFields.data.file_name, category: validatedFields.data.category },
      created_at: new Date().toISOString()
    });

    try {
      await notifySupplementalUploadAction(validatedFields.data.project_id);
    } catch (e) {
      console.error("Failed to notify supplemental upload", e);
    }

    let updatedStage: string | null = null;
    let stageRewound = false;

    // Automatic Stage Rewind: If new data/files are uploaded to an earlier workflow step,
    // automatically rewind the project state so team members can resume work from that step.
    const rewindInfo = getRewindStageForCategory(project?.status, validatedFields.data.category, project?.workflow_type);
    if (rewindInfo.shouldRewind && rewindInfo.targetStage) {
      try {
        const transitionResult = await transitionWorkflowAction(
          validatedFields.data.project_id,
          rewindInfo.targetStage,
          `Workflow rewound to ${rewindInfo.targetStage} due to newly uploaded ${validatedFields.data.category} (${validatedFields.data.file_name})`,
          { isAutomatedRewind: true }
        );
        if (transitionResult.success) {
          updatedStage = rewindInfo.targetStage;
          stageRewound = true;
        } else {
          console.warn("Automated workflow rewind failed:", transitionResult.error);
        }
      } catch (transErr) {
        console.error("Error executing automated workflow rewind:", transErr);
      }
    }

    revalidatePath(`/projects/${validatedFields.data.project_id}`);
    revalidatePath("/operations");
    revalidatePath("/field");
    revalidatePath("/engineer");

    return {
      success: true,
      data: {
        ...normalizeData(insertedFile),
        updated_project_stage: updatedStage,
        stage_rewound: stageRewound,
      }
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'An unexpected error occurred.' };
  }
}

export async function getProjectFilesAction(projectId: string): Promise<ActionResponse> {
  try {
    const supabase: any = await createClient();

    const profile: any = await getUserProfileAction();
    if (!profile) return { success: false, error: 'Unauthorized' };
    
    if (!(await checkActionRateLimit(profile.id, 'registerFileAction', 15, 60 * 1000))) {
      return { success: false, error: 'Rate limit exceeded for this action. Please try again later.' };
    }

    
    const accessCheck = await verifyProjectAccess(projectId, profile.id, profile.role as Role, true);
    if (!accessCheck.isAllowed) {
      return { success: false, error: accessCheck.error || "Permission denied." };
    }

    const { data, error } = await supabase
      .from('files')
      .select(`
        *,
        profiles:uploaded_by (
          first_name,
          last_name,
          email
        )
      `)
      .eq('project_id', projectId)
      .order('uploaded_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch files:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: normalizeData(data) };
  } catch (error: any) {
    return { success: false, error: error?.message || 'An unexpected error occurred.' };
  }
}



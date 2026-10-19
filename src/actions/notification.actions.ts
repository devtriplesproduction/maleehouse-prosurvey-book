'use server'

import { normalizeData } from '@/lib/normalize';

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserProfileAction } from './auth.actions'

export type NotificationItem = {
  id: string
  title: string
  message: string
  type: 'assignment' | 'stage_update' | 'approval' | 'rejection' | 'deadline_warning' | 'system' | 'payroll'
  is_read: boolean
  created_at: string
  related_project_id?: string
}

export async function insertNotification({
  userId,
  title,
  message,
  type,
  relatedProjectId,
}: {
  userId: string
  title: string
  message: string
  type: NotificationItem['type']
  relatedProjectId?: string
}) {
  try {
    const supabase: any = await createClient()
    const { error } = await supabase.rpc('generate_system_notification', {
      p_target_user_id: userId,
      p_title: title,
      p_message: message,
      p_type: type,
      p_related_project_id: relatedProjectId ?? null
    })
    
    if (error) throw error
    return { success: true }
  } catch (error: any) {
    console.error('[notification] insert error:', error.message)
    return { success: false }
  }
}

export async function insertNotificationsBatch(payloads: Array<{
  userId: string
  title: string
  message: string
  type: NotificationItem['type']
  relatedProjectId?: string
}>) {
  if (!payloads || payloads.length === 0) return { success: true }
  
  try {
    const supabase: any = await createClient()
    const dbPayloads = payloads.map(p => ({
      user_id: p.userId,
      title: p.title,
      message: p.message,
      type: p.type,
      related_project_id: p.relatedProjectId ?? null
    }))
    
    const { error } = await supabase.rpc('generate_system_notifications_batch', {
      payloads: dbPayloads
    })
    
    if (error) throw error
    return { success: true }
  } catch (error: any) {
    console.error('[notification] batch insert error:', error.message)
    return { success: false }
  }
}

export async function notifyAssignmentAction(userId: string, projectId: string, role?: string) {
  const supabase: any = await createClient()
  const { data: project } = await supabase.from('projects').select('name').eq('id', projectId).single()

  const roleMessages: Record<string, string> = {
    field: 'You have been assigned as Field Engineer',
    engineer: 'You have been assigned as Lead Engineer',
    accountant: 'You have been assigned as Accountant',
  }
  const roleTitle = role ? (roleMessages[role] || 'You have been assigned') : 'You have been assigned'

  return insertNotification({
    userId,
    title: 'Project Assignment',
    message: `${roleTitle} on project: "${project?.name || projectId}". Please check your dashboard for required actions.`,
    type: 'assignment',
    relatedProjectId: projectId,
  })
}

export async function notifyRejectionAction(userId: string, projectId: string, correctionNote: string) {
  const supabase: any = await createClient()
  const { data: project } = await supabase.from('projects').select('name').eq('id', projectId).single()
  return insertNotification({
    userId,
    title: 'Action Required: QC Rejected',
    message: `Deliverable for "${project?.name || projectId}" was rejected. Note: ${correctionNote.slice(0, 100)}`,
    type: 'rejection',
    relatedProjectId: projectId,
  })
}

export async function notifyApprovalAction(projectId: string) {
  const supabase: any = await createAdminClient()
  const { data: project } = await supabase.from('projects').select('name').eq('id', projectId).single()
  const { data: accountants } = await supabase.from('profiles').select('id').eq('role', 'accountant').eq('is_active', true)

  if (!accountants || accountants.length === 0) return { success: true }

  await insertNotificationsBatch(
    accountants.map((acc: any) => ({
      userId: acc.id,
      title: 'New Payment Pending',
      message: `Project "${project?.name || projectId}" approved by QC and ready for billing.`,
      type: 'approval',
      relatedProjectId: projectId,
    }))
  )
  return { success: true }
}

export async function notifyAdminDispatchOverrideRequestAction(projectId: string) {
  const supabase: any = await createAdminClient()
  const { data: project } = await supabase.from('projects').select('name').eq('id', projectId).single()
  const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin').eq('is_active', true)

  if (!admins || admins.length === 0) return { success: true }

  await insertNotificationsBatch(
    admins.map((admin: any) => ({
      userId: admin.id,
      title: 'Dispatch Override Requested',
      message: `Accountant requested dispatch override for Project "${project?.name || projectId}" (Payment is pending).`,
      type: 'approval',
      relatedProjectId: projectId,
    }))
  )
  return { success: true }
}

export async function notifyPaymentAction(projectId: string) {
  const supabase: any = await createAdminClient()
  const { data: project } = await supabase.from('projects').select('name, client_name, created_by').eq('id', projectId).single()
  if (!project) return { success: false, error: 'Project not found' }

  const { data: admins } = await supabase.from('profiles').select('id').in('role', ['admin', 'accountant'])
  const recipientIds = new Set<string>([
    ...(admins || []).map((a: any) => a.id),
    ...(project.created_by ? [project.created_by] : []),
  ])

  await insertNotificationsBatch(
    Array.from(recipientIds).map((userId: any) => ({
      userId,
      title: 'Payment Received',
      message: `Final payment for "${project.name}" (${project.client_name}) has been recorded.`,
      type: 'system',
      relatedProjectId: projectId,
    }))
  )
  return { success: true }
}

export async function notifyNewProjectAction(projectId: string, projectName: string) {
  const supabase: any = await createAdminClient()
  
  // Notify admin, accountant, and sales of new projects
  const { data: admins } = await supabase.from('profiles').select('id').in('role', ['admin', 'accountant', 'sales']).eq('is_active', true)
  
  if (!admins || admins.length === 0) return { success: true }

  await insertNotificationsBatch(
    admins.map((admin: any) => ({
      userId: admin.id,
      title: 'New Project Created',
      message: `A new project "${projectName}" has been created.`,
      type: 'system',
      relatedProjectId: projectId,
    }))
  )
  return { success: true }
}

export async function getNotificationsAction() {
  try {
    const profile: any = await getUserProfileAction()
    if (!profile) return { success: false, error: 'Unauthorized', data: [] }

    const supabase: any = await createClient()
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select(
        'id, user_id, title, message, type, is_read, related_project_id, created_at, projects!related_project_id(name, status)'
      )
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error

    // Define workflow stages to determine if a project has passed a role's responsibilities
    const STAGE_ORDER = [
      'project_created',    // 0
      'data_collection',    // 1
      'field_assigned',     // 2
      'field_work',         // 3
      'data_sync',          // 4
      'final_review',       // 5
      'completed'           // 6
    ];

    const ROLE_MAX_STAGE: Record<string, number> = {
      'accountant': 6, // Accountants might need to see things until the end for billing
      'field': 3,
      'engineer': 6,
      'admin': 6,
    };

    const userRole = profile.role || 'user';
    const maxStageIndexForRole = ROLE_MAX_STAGE[userRole] ?? 8;

    const filtered = (notifications || []).filter((n: any) => {
      // Keep system/non-project notifications
      if (!n.related_project_id) return true;

      const pStatus = (n as any).projects?.status;
      if (!pStatus) return true; // Keep if we can't determine status

      // Always hide if completed or cancelled
      if (['completed', 'cancelled', 'delivered'].includes(pStatus)) return false;

      const currentStageIndex = STAGE_ORDER.indexOf(pStatus);
      if (currentStageIndex === -1) return true; // Unknown status, keep it

      // Hide if the project has progressed PAST the user's maximum responsible stage
      if (currentStageIndex > maxStageIndexForRole) {
        return false;
      }

      return true;
    });

    const mapped = filtered.map((n: any) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type as NotificationItem['type'],
      is_read: n.is_read,
      created_at: n.created_at,
      related_project_id: n.related_project_id ?? undefined,
      project_name: (n as any).projects?.name ?? undefined,
      project_status: (n as any).projects?.status ?? undefined,
    }))

    // Limit to 50 after filtering
    return { success: true, data: normalizeData(mapped.slice(0, 50)) }
  } catch (error: any) {
    return { success: false, error: error.message, data: [] }
  }
}

export async function markNotificationAsReadAction(id: string) {
  try {
    const supabase: any = await createClient()
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function markAllNotificationsAsReadAction() {
  try {
    const profile: any = await getUserProfileAction()
    if (!profile) return { success: false, error: 'Unauthorized' }

    const supabase: any = await createClient()
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', profile.id)
      .eq('is_read', false)

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function clearAllNotificationsAction() {
  try {
    const profile: any = await getUserProfileAction()
    if (!profile) return { success: false, error: 'Unauthorized' }

    const supabase: any = await createClient()
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', profile.id)

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function notifyMentionAction(authorName: string, recipientIds: string[], projectId: string, commentSnippet: string) {
  if (!recipientIds || recipientIds.length === 0) return { success: true }
  const supabase: any = await createClient()
  const { data: project } = await supabase.from('projects').select('name').eq('id', projectId).single()
  const message = `${authorName} mentioned you in "${project?.name || projectId}": "${commentSnippet.slice(0, 100)}${commentSnippet.length > 100 ? '...' : ''}"`

  const payloads = recipientIds.map(userId => ({
    user_id: userId,
    title: 'You were mentioned',
    message,
    type: 'system',
    related_project_id: projectId
  }))

  try {
    const { error } = await supabase.from('notifications').insert(payloads)
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function notifyStageUpdateAction(projectId: string, fromStage: string | null, toStage: string) {
  const supabase: any = await createAdminClient()

  // Parallel fetch: project + team + admins (was sequential)
  const [projectRes, assignmentsRes, adminsRes] = await Promise.all([
    supabase.from('projects').select('name').eq('id', projectId).single(),
    supabase.from('project_assignments').select('user_id, role').eq('project_id', projectId),
    supabase.from('profiles').select('id, role').in('role', ['admin', 'accountant']),
  ])

  const project = projectRes.data
  if (!project) return { success: true }

  const assignments = assignmentsRes.data || []
  const adminIds = (adminsRes.data || []).filter((a: any) => a.role === 'admin' || a.role === 'accountant').map((a: any) => a.id)
  const accountantIds = (adminsRes.data || []).filter((a: any) => a.role === 'accountant').map((a: any) => a.id)

  const getAssignedByRole = (role: string) =>
    assignments.filter((a: any) => a.role === role).map((a: any) => a.user_id)

  const stageNotifications: Record<string, { recipients: string[]; title: string; message: string }[]> = {
    ready_for_dispatch: [
      {
        recipients: adminIds,
        title: 'Project Ready for Dispatch',
        message: `Milestone payment for "${project.name}" has been verified. The project is ready to be dispatched to Engineering.`,
      },
    ],
    project_created: [
      {
        recipients: adminIds,
        title: 'Project Dispatched to Engineering',
        message: `Project "${project.name}" has been officially dispatched to Engineering survey department.`,
      },
    ],
    data_collection: [
      {
        recipients: getAssignedByRole('field'),
        title: 'Project Assigned to Operations',
        message: `Project "${project.name}" has entered Survey Operations. Please prepare your assignments.`,
      },
    ],
    field_work: [
      {
        recipients: getAssignedByRole('field'),
        title: 'Action Required: Field Survey',
        message: `Project "${project.name}" has entered Field Survey stage. Please begin site work.`,
      },
      {
        recipients: adminIds,
        title: 'Assignment Accepted',
        message: `Field Engineer has accepted the assignment and started work on "${project.name}".`,
      },
    ],
    data_sync: [
      {
        recipients: getAssignedByRole('engineer'),
        title: 'Action Required: Survey Data Processing',
        message: `Field survey data for "${project.name}" is ready for engineer validation and deliverable generation.`,
      },
    ],
    completed: [
      {
        recipients: [...adminIds, ...getAssignedByRole('engineer'), ...getAssignedByRole('field')],
        title: 'Project Completed 🎉',
        message: `Project "${project.name}" has been completed and delivered to the client.`,
      },
    ],
  }

  const notificationsForStage = stageNotifications[toStage]
  if (!notificationsForStage) return { success: true }

  // Single bulk insert instead of N RPCs
  const rows: any[] = []
  const now = new Date().toISOString()
  for (const { recipients, title, message } of notificationsForStage) {
    for (const userId of Array.from(new Set(recipients.filter(Boolean)))) {
      rows.push({
        id: `ntf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        user_id: userId,
        title,
        message,
        type: 'stage_update',
        is_read: false,
        related_project_id: projectId,
        created_at: now,
      })
    }
  }

  if (rows.length > 0) {
    await supabase.from('notifications').insert(rows)
  }
  return { success: true }
}

export async function notifyRequirementWarningAction(projectId: string, warningMessage: string) {
  const supabase: any = await createClient()
  const { data: project } = await supabase.from('projects').select('name').eq('id', projectId).single()
  const { data: assignments } = await supabase.from('project_assignments').select('user_id').eq('project_id', projectId)

  if (!project) return { success: true }

  await insertNotificationsBatch(
    (assignments || []).map((asg: any) => ({
      userId: asg.user_id,
      title: 'Requirement Verification Alert',
      message: `Issue in "${project.name}": ${warningMessage}`,
      type: 'system',
      relatedProjectId: projectId,
    }))
  )
  return { success: true }
}

export async function notifySupplementalUploadAction(projectId: string) {
  try {
    const profile: any = await getUserProfileAction()
    if (!profile) return { success: false, error: 'Unauthorized' }

    const supabase: any = await createAdminClient()
    const { data: project } = await supabase.from('projects').select('name, status').eq('id', projectId).single()
    const { data: assignments } = await supabase
      .from('project_assignments')
      .select('user_id, role, profiles(role)')
      .eq('project_id', projectId)

    if (!project) return { success: false, error: 'Project not found' }

    const uploaderName = `${profile.first_name} ${profile.last_name}`
    const uploaderRole = profile.role

    // Determine who should be notified based on who uploaded
    // Each role notifies the next stage actor, not everyone
    const getAssignedByRole = (role: string): string[] =>
      (assignments || [])
        .filter((a: any) => a.role === role)
        .map((a: any) => a.user_id)

    let recipients: string[] = []
    let title = 'New Document Uploaded'
    let message = `${uploaderName} uploaded new documents to "${project.name}".`

    if (uploaderRole === 'engineer') {
      recipients = [...getAssignedByRole('field')]
      title = 'New Project Documents Available'
      message = `Engineer ${uploaderName} uploaded new project documents to "${project.name}".`
    } else if (uploaderRole === 'field') {
      // Field uploaded survey data: notify engineer
      recipients = getAssignedByRole('engineer')
      title = 'Field Survey Data Uploaded'
      message = `Field Engineer ${uploaderName} has uploaded survey data for "${project.name}". Please begin data review.`
    } else {
      // Admin or other: notify all participants
      recipients = Array.from(new Set((assignments || []).map((a: any) => a.user_id)))
    }

    // Add accountants to recipients
    const { data: accountants } = await supabase.from('profiles').select('id').eq('role', 'accountant')
    if (accountants) {
      recipients.push(...accountants.map((a: any) => a.id))
    }

    // Remove the uploader themselves
    recipients = recipients.filter((id) => id !== profile.id)

    await insertNotificationsBatch(
      Array.from(new Set(recipients)).map((userId: any) => ({
        userId,
        title,
        message,
        type: 'system',
        relatedProjectId: projectId,
      }))
    )

    await supabase.from('activity_logs').insert({
      project_id: projectId,
      user_id: profile.id,
      action: 'SUPPLEMENTAL_UPLOAD_NOTIFIED',
      details: {
        message: `${uploaderName} notified team of supplemental documents for "${project.name}".`
      }
    })

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function notifyNewHolidayAction(holidayName: string, date: string, isOptional: boolean) {
  try {
    const supabase: any = await createAdminClient()
    const { data: users } = await supabase.from('profiles').select('id').eq('is_active', true)
    
    if (!users || users.length === 0) return { success: true }
    
    const formattedDate = new Date(date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    const typeLabel = isOptional ? 'Optional Holiday' : 'Public Holiday'
    
    await insertNotificationsBatch(
      users.map((u: any) => ({
        userId: u.id,
        title: 'New Holiday Added',
        message: `${holidayName} (${typeLabel}) is scheduled for ${formattedDate}.`,
        type: 'system',
      }))
    )
    return { success: true }
  } catch (error: any) {
    console.error('[notification] notifyNewHoliday error:', error.message)
    return { success: false, error: error.message }
  }
}

export async function notifyUpcomingHolidaysAction(cronSecret?: string) {
  try {
    const expectedSecret = process.env.CRON_SECRET
    if (!expectedSecret || cronSecret !== expectedSecret) {
      return { success: false, error: 'Unauthorized cron request' }
    }

    const supabase: any = createAdminClient()

    // Calculate tomorrow's date in YYYY-MM-DD
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]

    // Fetch holidays for tomorrow
    const { data: holidays } = await supabase
      .from('holidays')
      .select('*')
      .eq('date', tomorrowStr)

    if (!holidays || holidays.length === 0) {
      return { success: true, message: 'No holidays tomorrow' }
    }

    // Fetch active users
    const { data: users } = await supabase.from('profiles').select('id').eq('is_active', true)
    
    if (!users || users.length === 0) return { success: true, message: 'No active users to notify' }

    let notificationsSent = 0

    for (const holiday of holidays) {
      const typeLabel = 'Public Holiday';
      
      await insertNotificationsBatch(
        users.map((u: any) => ({
          userId: u.id,
          title: 'Reminder: Upcoming Holiday',
          message: `Reminder: Tomorrow is ${holiday.name} (${typeLabel}).`,
          type: 'system',
        }))
      )
      notificationsSent += users.length
    }

    return { success: true, message: `Sent ${notificationsSent} notifications for ${holidays.length} holiday(s)` }
  } catch (error: any) {
    console.error('[notification] notifyUpcomingHolidays error:', error.message)
    return { success: false, error: error.message }
  }
}

export async function notifyFollowUpScheduledAction(projectId: string, nextDate: string, status: string, userId: string, userTimezone?: string) {
  const supabase: any = await createClient()
  const { data: project } = await supabase.from('projects').select('name, client_name').eq('id', projectId).single()
  if (!project) return { success: false }

  const formattedDate = new Date(nextDate).toLocaleString('en-US', { 
    weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: userTimezone
  })

  return insertNotification({
    userId,
    title: 'Follow-up Scheduled',
    message: `Follow-up for "${project.name}" (${project.client_name}) scheduled on ${formattedDate}. Status: ${status}`,
    type: 'system',
    relatedProjectId: projectId,
  })
}


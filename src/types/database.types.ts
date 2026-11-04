export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Enums: {
      audit_severity: 'info' | 'warning' | 'critical' | 'security'
      cad_revision_status: 'pending_review' | 'approved' | 'rejected' | 'rework_requested'
      employee_status: 'active' | 'probation' | 'onboarding_pending' | 'invited' | 'suspended' | 'resigned' | 'terminated'
      field_report_status: 'submitted' | 'acknowledged' | 'resolved'
      field_report_type: 'progress' | 'completion' | 'issue'
      invoice_status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'accepted' | 'rejected' | 'in_review'
      leave_status: 'pending' | 'approved' | 'rejected' | 'cancelled'
      leave_type: 'sick' | 'casual' | 'earned' | 'maternity' | 'paternity' | 'other'
      milestone_status: 'pending' | 'invoiced' | 'paid'
      notification_type: 'assignment' | 'stage_update' | 'approval' | 'rejection' | 'deadline_warning' | 'system'
      payment_status: 'pending' | 'verified' | 'rejected'
      project_priority: 'low' | 'medium' | 'high' | 'urgent'
      project_status: 'lead' | 'requirement_gathering' | 'quotation_requested' | 'quotation_sent' | 'payment_pending' | 'payment_done' | 'ready_for_dispatch' | 'project_created' | 'data_collection' | 'prototype' | 'review' | 'field_assigned' | 'field_work' | 'data_sync' | 'final_review' | 'completed' | 'archived'
      quotation_status: 'Draft' | 'Pending' | 'Sent' | 'Viewed' | 'Approved' | 'Rejected' | 'Revision Requested' | 'Expired' | 'Superseded'
      site_type: 'residential' | 'commercial' | 'industrial' | 'infrastructure' | 'agricultural' | 'government' | 'semi_government' | 'other'
      task_status: 'pending' | 'in_progress' | 'submitted' | 'completed' | 'overdue' | 'cancelled'
      user_role: 'admin' | 'sales' | 'accountant' | 'engineer' | 'field' | 'hr'
      visit_status: 'scheduled' | 'completed' | 'cancelled' | 'paid'
    }
    Tables: {
      activity_logs: {
        Row: {
          id: string
          project_id: string | null
          user_id: string | null
          action: string
          details: Json
          severity: Database['public']['Enums']['audit_severity'] | null
          target_user_id: string | null
          actor_email: string | null
          created_at: string
        }
        Insert: {
          id: string
          project_id?: string | null
          user_id?: string | null
          action: string
          details?: Json
          severity?: Database['public']['Enums']['audit_severity'] | null
          target_user_id?: string | null
          actor_email?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string | null
          user_id?: string | null
          action?: string
          details?: Json
          severity?: Database['public']['Enums']['audit_severity'] | null
          target_user_id?: string | null
          actor_email?: string | null
          created_at?: string
        }
      }
      bank_accounts: {
        Row: {
          id: string
          bank_name: string
          account_name: string
          account_number: string
          ifsc_code: string
          branch_name: string
          is_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          bank_name: string
          account_name: string
          account_number: string
          ifsc_code: string
          branch_name: string
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          bank_name?: string
          account_name?: string
          account_number?: string
          ifsc_code?: string
          branch_name?: string
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      cad_revisions: {
        Row: {
          id: string
          project_id: string
          submitted_by: string
          revision_number: number
          title: string | null
          description: string | null
          files: Json
          status: Database['public']['Enums']['cad_revision_status']
          reviewed_by: string | null
          reviewed_at: string | null
          review_notes: string | null
          revision_type: string
          submitted_at: string
          updated_at: string
        }
        Insert: {
          id: string
          project_id: string
          submitted_by: string
          revision_number?: number
          title?: string | null
          description?: string | null
          files?: Json
          status?: Database['public']['Enums']['cad_revision_status']
          reviewed_by?: string | null
          reviewed_at?: string | null
          review_notes?: string | null
          revision_type?: string
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          submitted_by?: string
          revision_number?: number
          title?: string | null
          description?: string | null
          files?: Json
          status?: Database['public']['Enums']['cad_revision_status']
          reviewed_by?: string | null
          reviewed_at?: string | null
          review_notes?: string | null
          revision_type?: string
          submitted_at?: string
          updated_at?: string
        }
      }
      comments: {
        Row: {
          id: string
          project_id: string
          user_id: string
          content: string
          mentions: string[] | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id: string
          project_id: string
          user_id: string
          content: string
          mentions?: string[] | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          content?: string
          mentions?: string[] | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      delivery_checklist: {
        Row: {
          id: string
          project_id: string
          qc_approved: boolean
          deliverables_uploaded: boolean
          client_acknowledged: boolean
          final_payment_cleared: boolean
          updated_at: string
        }
        Insert: {
          id: string
          project_id: string
          qc_approved?: boolean
          deliverables_uploaded?: boolean
          client_acknowledged?: boolean
          final_payment_cleared?: boolean
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          qc_approved?: boolean
          deliverables_uploaded?: boolean
          client_acknowledged?: boolean
          final_payment_cleared?: boolean
          updated_at?: string
        }
      }
      eod_reports: {
        Row: {
          id: string
          user_id: string
          date: string
          tasks_completed: string
          hours_spent: number
          blockers: string | null
          status: string | null
          adjusted_hours: number | null
          admin_note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          user_id: string
          date?: string
          tasks_completed: string
          hours_spent?: number
          blockers?: string | null
          status?: string | null
          adjusted_hours?: number | null
          admin_note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          tasks_completed?: string
          hours_spent?: number
          blockers?: string | null
          status?: string | null
          adjusted_hours?: number | null
          admin_note?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      field_reports: {
        Row: {
          id: string
          project_id: string
          submitted_by: string
          report_type: Database['public']['Enums']['field_report_type']
          report_date: string
          content: string
          issues_identified: string | null
          attachments: Json
          status: Database['public']['Enums']['field_report_status']
          acknowledged_by: string | null
          acknowledged_at: string | null
          location_lat: number | null
          location_lng: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          project_id: string
          submitted_by: string
          report_type?: Database['public']['Enums']['field_report_type']
          report_date?: string
          content: string
          issues_identified?: string | null
          attachments?: Json
          status?: Database['public']['Enums']['field_report_status']
          acknowledged_by?: string | null
          acknowledged_at?: string | null
          location_lat?: number | null
          location_lng?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          submitted_by?: string
          report_type?: Database['public']['Enums']['field_report_type']
          report_date?: string
          content?: string
          issues_identified?: string | null
          attachments?: Json
          status?: Database['public']['Enums']['field_report_status']
          acknowledged_by?: string | null
          acknowledged_at?: string | null
          location_lat?: number | null
          location_lng?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      files: {
        Row: {
          id: string
          project_id: string
          file_name: string
          file_url: string
          category: string
          file_size_bytes: number | null
          mime_type: string | null
          uploaded_by: string
          uploaded_at: string
          deleted_at: string | null
        }
        Insert: {
          id: string
          project_id: string
          file_name: string
          file_url: string
          category: string
          file_size_bytes?: number | null
          mime_type?: string | null
          uploaded_by: string
          uploaded_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          file_name?: string
          file_url?: string
          category?: string
          file_size_bytes?: number | null
          mime_type?: string | null
          uploaded_by?: string
          uploaded_at?: string
          deleted_at?: string | null
        }
      }
      fund_allocations: {
        Row: {
          id: string
          project_id: string
          bank_account_id: string | null
          service_divide: string
          day: number | null
          amount: number | null
          remark: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          project_id: string
          bank_account_id?: string | null
          service_divide: string
          day?: number | null
          amount?: number | null
          remark?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          bank_account_id?: string | null
          service_divide?: string
          day?: number | null
          amount?: number | null
          remark?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      invoices: {
        Row: {
          id: string
          project_id: string
          invoice_number: string
          amount: number
          gst_rate: number
          gst_amount: number
          total_amount: number
          status: Database['public']['Enums']['invoice_status']
          milestone_id: string | null
          visit_id: string | null
          due_date: string | null
          notes: string | null
          created_by: string | null
          bank_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          project_id: string
          invoice_number: string
          amount: number
          gst_rate?: number
          gst_amount?: number
          total_amount: number
          status?: Database['public']['Enums']['invoice_status']
          milestone_id?: string | null
          visit_id?: string | null
          due_date?: string | null
          notes?: string | null
          created_by?: string | null
          bank_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          invoice_number?: string
          amount?: number
          gst_rate?: number
          gst_amount?: number
          total_amount?: number
          status?: Database['public']['Enums']['invoice_status']
          milestone_id?: string | null
          visit_id?: string | null
          due_date?: string | null
          notes?: string | null
          created_by?: string | null
          bank_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      issues: {
        Row: {
          id: string
          project_id: string
          title: string
          description: string
          severity: string | null
          status: string | null
          reported_by: string
          assigned_to: string | null
          resolved_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          project_id: string
          title: string
          description: string
          severity?: string | null
          status?: string | null
          reported_by: string
          assigned_to?: string | null
          resolved_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          title?: string
          description?: string
          severity?: string | null
          status?: string | null
          reported_by?: string
          assigned_to?: string | null
          resolved_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      leaves: {
        Row: {
          id: string
          user_id: string
          start_date: string
          end_date: string
          leave_type: Database['public']['Enums']['leave_type']
          reason: string
          status: Database['public']['Enums']['leave_status']
          approved_by: string | null
          approved_at: string | null
          rejection_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          user_id: string
          start_date: string
          end_date: string
          leave_type?: Database['public']['Enums']['leave_type']
          reason: string
          status?: Database['public']['Enums']['leave_status']
          approved_by?: string | null
          approved_at?: string | null
          rejection_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          start_date?: string
          end_date?: string
          leave_type?: Database['public']['Enums']['leave_type']
          reason?: string
          status?: Database['public']['Enums']['leave_status']
          approved_by?: string | null
          approved_at?: string | null
          rejection_reason?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          title: string
          message: string
          type: Database['public']['Enums']['notification_type']
          is_read: boolean
          related_project_id: string | null
          created_at: string
        }
        Insert: {
          id: string
          user_id: string
          title: string
          message: string
          type?: Database['public']['Enums']['notification_type']
          is_read?: boolean
          related_project_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          message?: string
          type?: Database['public']['Enums']['notification_type']
          is_read?: boolean
          related_project_id?: string | null
          created_at?: string
        }
      }
      payments: {
        Row: {
          id: string
          project_id: string
          invoice_id: string | null
          amount: number
          payment_method: string
          transaction_id: string | null
          receipt_url: string | null
          status: Database['public']['Enums']['payment_status']
          verified_by: string | null
          verified_at: string | null
          rejection_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          project_id: string
          invoice_id?: string | null
          amount: number
          payment_method?: string
          transaction_id?: string | null
          receipt_url?: string | null
          status?: Database['public']['Enums']['payment_status']
          verified_by?: string | null
          verified_at?: string | null
          rejection_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          invoice_id?: string | null
          amount?: number
          payment_method?: string
          transaction_id?: string | null
          receipt_url?: string | null
          status?: Database['public']['Enums']['payment_status']
          verified_by?: string | null
          verified_at?: string | null
          rejection_reason?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          email: string
          role: Database['public']['Enums']['user_role']
          first_name: string | null
          last_name: string | null
          phone_number: string | null
          dob: string | null
          gender: string | null
          personal_email: string | null
          emergency_contact: string | null
          profile_photo: string | null
          address: string | null
          employee_id: string | null
          department: string | null
          designation: string | null
          joining_date: string | null
          employment_type: string | null
          salary: number | null
          experience: number | null
          location: string | null
          status: Database['public']['Enums']['employee_status']
          is_active: boolean
          branch: string | null
          office_location: string | null
          operational_zone: string | null
          reporting_manager_id: string | null
          department_head_id: string | null
          escalation_chain: string[] | null
          approval_authority: boolean | null
          force_password_reset: boolean | null
          temp_password_expires_at: string | null
          documents: Json | null
          created_at: string
          updated_at: string | null
          deleted_at: string | null
        }
        Insert: {
          id?: string
          email: string
          role?: Database['public']['Enums']['user_role']
          first_name?: string | null
          last_name?: string | null
          phone_number?: string | null
          dob?: string | null
          gender?: string | null
          personal_email?: string | null
          emergency_contact?: string | null
          profile_photo?: string | null
          address?: string | null
          employee_id?: string | null
          department?: string | null
          designation?: string | null
          joining_date?: string | null
          employment_type?: string | null
          salary?: number | null
          experience?: number | null
          location?: string | null
          status?: Database['public']['Enums']['employee_status']
          is_active?: boolean
          branch?: string | null
          office_location?: string | null
          operational_zone?: string | null
          reporting_manager_id?: string | null
          department_head_id?: string | null
          escalation_chain?: string[] | null
          approval_authority?: boolean | null
          force_password_reset?: boolean | null
          temp_password_expires_at?: string | null
          documents?: Json | null
          created_at?: string
          updated_at?: string | null
          deleted_at?: string | null
        }
        Update: {
          id?: string
          email?: string
          role?: Database['public']['Enums']['user_role']
          first_name?: string | null
          last_name?: string | null
          phone_number?: string | null
          dob?: string | null
          gender?: string | null
          personal_email?: string | null
          emergency_contact?: string | null
          profile_photo?: string | null
          address?: string | null
          employee_id?: string | null
          department?: string | null
          designation?: string | null
          joining_date?: string | null
          employment_type?: string | null
          salary?: number | null
          experience?: number | null
          location?: string | null
          status?: Database['public']['Enums']['employee_status']
          is_active?: boolean
          branch?: string | null
          office_location?: string | null
          operational_zone?: string | null
          reporting_manager_id?: string | null
          department_head_id?: string | null
          escalation_chain?: string[] | null
          approval_authority?: boolean | null
          force_password_reset?: boolean | null
          temp_password_expires_at?: string | null
          documents?: Json | null
          created_at?: string
          updated_at?: string | null
          deleted_at?: string | null
        }
      }
      project_accounts_owners: {
        Row: {
          id: string
          project_id: string
          accountant_id: string
          assigned_at: string
        }
        Insert: {
          id: string
          project_id: string
          accountant_id: string
          assigned_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          accountant_id?: string
          assigned_at?: string
        }
      }
      project_budget_items: {
        Row: {
          id: string
          project_id: string
          section: string
          particulars: string
          qty: number | null
          rate: number | null
          days: number | null
          amount: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          project_id: string
          section: string
          particulars: string
          qty?: number | null
          rate?: number | null
          days?: number | null
          amount?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          section?: string
          particulars?: string
          qty?: number | null
          rate?: number | null
          days?: number | null
          amount?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      project_assignments: {
        Row: {
          id: string
          project_id: string
          user_id: string
          role: string
          assigned_by: string | null
          assigned_at: string
          removed_at: string | null
        }
        Insert: {
          id: string
          project_id: string
          user_id: string
          role: string
          assigned_by?: string | null
          assigned_at?: string
          removed_at?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          role?: string
          assigned_by?: string | null
          assigned_at?: string
          removed_at?: string | null
        }
      }
      project_finances: {
        Row: {
          id: string
          project_id: string
          total_quoted_amount: number
          total_invoiced_amount: number
          total_paid_amount: number
          currency: string
          updated_at: string
        }
        Insert: {
          id: string
          project_id: string
          total_quoted_amount?: number
          total_invoiced_amount?: number
          total_paid_amount?: number
          currency?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          total_quoted_amount?: number
          total_invoiced_amount?: number
          total_paid_amount?: number
          currency?: string
          updated_at?: string
        }
      }
      project_milestones: {
        Row: {
          id: string
          project_id: string
          title: string
          description: string | null
          amount: number
          due_date: string | null
          linked_stage: string | null
          is_activation_gate: boolean
          status: Database['public']['Enums']['milestone_status']
          is_compulsory: boolean
          sort_order: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          project_id: string
          title: string
          description?: string | null
          amount?: number
          due_date?: string | null
          linked_stage?: string | null
          is_activation_gate?: boolean
          status?: Database['public']['Enums']['milestone_status']
          is_compulsory?: boolean
          sort_order?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          title?: string
          description?: string | null
          amount?: number
          due_date?: string | null
          linked_stage?: string | null
          is_activation_gate?: boolean
          status?: Database['public']['Enums']['milestone_status']
          is_compulsory?: boolean
          sort_order?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      project_visits: {
        Row: {
          id: string
          project_id: string
          scheduled_date: string
          purpose: string
          notes: string | null
          assigned_team: string[]
          status: Database['public']['Enums']['visit_status']
          completed_date: string | null
          report_id: string | null
          is_billable: boolean
          visit_cost: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          project_id: string
          scheduled_date: string
          purpose: string
          notes?: string | null
          assigned_team?: string[]
          status?: Database['public']['Enums']['visit_status']
          completed_date?: string | null
          report_id?: string | null
          is_billable?: boolean
          visit_cost?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          scheduled_date?: string
          purpose?: string
          notes?: string | null
          assigned_team?: string[]
          status?: Database['public']['Enums']['visit_status']
          completed_date?: string | null
          report_id?: string | null
          is_billable?: boolean
          visit_cost?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          name: string
          client_name: string
          client_contact: string | null
          client_address: string | null
          site_type: string | null
          site_coordinates: string | null
          services: string[] | null
          survey_requirements: string | null
          description: string | null
          status: string
          priority: string | null
          requirement_checklist: Json | null
          target_completion_date: string | null
          follow_up_date: string | null
          is_frozen: boolean
          freeze_reason: string | null
          frozen_at: string | null
          frozen_by: string | null
          bypass_active: boolean
          satisfaction_score: number | null
          archival_note: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id: string
          name: string
          client_name: string
          client_contact?: string | null
          client_address?: string | null
          site_type?: string | null
          site_coordinates?: string | null
          services?: string[] | null
          survey_requirements?: string | null
          description?: string | null
          status?: string
          priority?: string | null
          requirement_checklist?: Json | null
          target_completion_date?: string | null
          follow_up_date?: string | null
          is_frozen?: boolean
          freeze_reason?: string | null
          frozen_at?: string | null
          frozen_by?: string | null
          bypass_active?: boolean
          satisfaction_score?: number | null
          archival_note?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          client_name?: string
          client_contact?: string | null
          client_address?: string | null
          site_type?: string | null
          site_coordinates?: string | null
          services?: string[] | null
          survey_requirements?: string | null
          description?: string | null
          status?: string
          priority?: string | null
          requirement_checklist?: Json | null
          target_completion_date?: string | null
          follow_up_date?: string | null
          is_frozen?: boolean
          freeze_reason?: string | null
          frozen_at?: string | null
          frozen_by?: string | null
          bypass_active?: boolean
          satisfaction_score?: number | null
          archival_note?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      quotation_templates: {
        Row: {
          id: string
          name: string
          category: string | null
          is_default: boolean
          clauses: Json
          created_by: string | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id: string
          name: string
          category?: string | null
          is_default?: boolean
          clauses?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          category?: string | null
          is_default?: boolean
          clauses?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string | null
        }
      }
      quotation_versions: {
        Row: {
          id: string
          quotation_id: string
          version_number: number
          items: Json
          subtotal: number
          discount_pct: number | null
          discount_amount: number | null
          gst_rate: number
          gst_amount: number
          total_amount: number
          notes: string | null
          terms: string | null
          internal_notes: string | null
          status: Database['public']['Enums']['quotation_status']
          revision_reason: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id: string
          quotation_id: string
          version_number: number
          items?: Json
          subtotal?: number
          discount_pct?: number | null
          discount_amount?: number | null
          gst_rate?: number
          gst_amount?: number
          total_amount?: number
          notes?: string | null
          terms?: string | null
          internal_notes?: string | null
          status?: Database['public']['Enums']['quotation_status']
          revision_reason?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          quotation_id?: string
          version_number?: number
          items?: Json
          subtotal?: number
          discount_pct?: number | null
          discount_amount?: number | null
          gst_rate?: number
          gst_amount?: number
          total_amount?: number
          notes?: string | null
          terms?: string | null
          internal_notes?: string | null
          status?: Database['public']['Enums']['quotation_status']
          revision_reason?: string | null
          created_by?: string | null
          created_at?: string
        }
      }
      quotations: {
        Row: {
          id: string
          project_id: string | null
          quotation_number: string
          client_token: string
          client_details: Json | null
          items: Json
          subtotal: number
          discount_pct: number
          discount_amount: number
          gst_rate: number
          gst_amount: number
          total_amount: number
          notes: string | null
          terms: string | null
          internal_notes: string | null
          status: Database['public']['Enums']['quotation_status']
          current_version: number
          rejection_category: string | null
          rejection_reason: string | null
          client_viewed_at: string | null
          client_approved_at: string | null
          client_approver_phone: string | null
          created_by: string | null
          bank_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          project_id?: string | null
          quotation_number: string
          client_token?: string
          client_details?: Json | null
          items?: Json
          subtotal?: number
          discount_pct?: number
          discount_amount?: number
          gst_rate?: number
          gst_amount?: number
          total_amount?: number
          notes?: string | null
          terms?: string | null
          internal_notes?: string | null
          status?: Database['public']['Enums']['quotation_status']
          current_version?: number
          rejection_category?: string | null
          rejection_reason?: string | null
          client_viewed_at?: string | null
          client_approved_at?: string | null
          client_approver_phone?: string | null
          created_by?: string | null
          bank_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string | null
          quotation_number?: string
          client_token?: string
          client_details?: Json | null
          items?: Json
          subtotal?: number
          discount_pct?: number
          discount_amount?: number
          gst_rate?: number
          gst_amount?: number
          total_amount?: number
          notes?: string | null
          terms?: string | null
          internal_notes?: string | null
          status?: Database['public']['Enums']['quotation_status']
          current_version?: number
          rejection_category?: string | null
          rejection_reason?: string | null
          client_viewed_at?: string | null
          client_approved_at?: string | null
          client_approver_phone?: string | null
          created_by?: string | null
          bank_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      salary_increments: {
        Row: {
          id: string
          employee_id: string
          previous_salary: number
          new_salary: number
          increment_amount: number | null
          increment_percentage: number | null
          effective_date: string
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          employee_id: string
          previous_salary: number
          new_salary: number
          increment_amount?: number | null
          increment_percentage?: number | null
          effective_date: string
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          employee_id?: string
          previous_salary?: number
          new_salary?: number
          increment_amount?: number | null
          increment_percentage?: number | null
          effective_date?: string
          created_at?: string
          created_by?: string | null
        }
      }
      sops: {
        Row: {
          id: string
          title: string
          category: string | null
          content: string | null
          version: string | null
          is_active: boolean | null
          created_by: string | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          title: string
          category?: string | null
          content?: string | null
          version?: string | null
          is_active?: boolean | null
          created_by?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          title?: string
          category?: string | null
          content?: string | null
          version?: string | null
          is_active?: boolean | null
          created_by?: string | null
          created_at?: string
          updated_at?: string | null
        }
      }
      tasks: {
        Row: {
          id: string
          project_id: string | null
          title: string
          description: string | null
          stage: string | null
          assigned_to: string | null
          assigned_by: string | null
          status: Database['public']['Enums']['task_status']
          priority: Database['public']['Enums']['project_priority'] | null
          due_date: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          project_id?: string | null
          title: string
          description?: string | null
          stage?: string | null
          assigned_to?: string | null
          assigned_by?: string | null
          status?: Database['public']['Enums']['task_status']
          priority?: Database['public']['Enums']['project_priority'] | null
          due_date?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string | null
          title?: string
          description?: string | null
          stage?: string | null
          assigned_to?: string | null
          assigned_by?: string | null
          status?: Database['public']['Enums']['task_status']
          priority?: Database['public']['Enums']['project_priority'] | null
          due_date?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      workflow_history: {
        Row: {
          id: string
          project_id: string
          from_stage: string | null
          to_stage: string
          comment: string | null
          changed_by: string | null
          created_at: string
        }
        Insert: {
          id: string
          project_id: string
          from_stage?: string | null
          to_stage: string
          comment?: string | null
          changed_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          from_stage?: string | null
          to_stage?: string
          comment?: string | null
          changed_by?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
  }
}

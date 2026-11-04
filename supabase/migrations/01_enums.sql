-- ============================================================
-- FILE: 01_enums.sql
-- PURPOSE: Create all application enums before table creation.
-- ROLLBACK: DROP TYPE IF EXISTS ... CASCADE for each enum.
-- SAFE: Uses IF NOT EXISTS — idempotent.
-- ============================================================

-- Project lifecycle stages
DO $$ BEGIN
  CREATE TYPE project_status AS ENUM (
    'lead',
    'requirement_gathering',
    'quotation_requested',
    'quotation_sent',
    'payment_pending',
    'payment_done',
    'project_created',
    'data_collection',
    'prototype',
    'review',
    'field_assigned',
    'field_work',
    'data_sync',
    'final_review',
    'completed',
    'archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- User roles matching RBAC definition
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'admin',
    'sales',
    'accountant',
    'engineer',
    'cad',
    'field',
    'field_engineer',
    'qc',
    'employee'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Quotation status state machine
DO $$ BEGIN
  CREATE TYPE quotation_status AS ENUM (
    'Draft',
    'Pending',
    'Sent',
    'Viewed',
    'Approved',
    'Rejected',
    'Revision Requested',
    'Expired',
    'Superseded'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Payment verification status
DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM (
    'pending',
    'verified',
    'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Invoice status
DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM (
    'draft',
    'sent',
    'paid',
    'overdue',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Milestone payment status
DO $$ BEGIN
  CREATE TYPE milestone_status AS ENUM (
    'pending',
    'invoiced',
    'paid'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CAD revision review status
DO $$ BEGIN
  CREATE TYPE cad_revision_status AS ENUM (
    'pending_review',
    'approved',
    'rejected',
    'rework_requested'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Field report type
DO $$ BEGIN
  CREATE TYPE field_report_type AS ENUM (
    'progress',
    'completion',
    'issue'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Field report status
DO $$ BEGIN
  CREATE TYPE field_report_status AS ENUM (
    'submitted',
    'acknowledged',
    'resolved'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Notification type
DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM (
    'assignment',
    'stage_update',
    'approval',
    'rejection',
    'deadline_warning',
    'system'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Employee/profile status
DO $$ BEGIN
  CREATE TYPE employee_status AS ENUM (
    'active',
    'probation',
    'onboarding_pending',
    'invited',
    'suspended',
    'resigned',
    'terminated'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Project visit status
DO $$ BEGIN
  CREATE TYPE visit_status AS ENUM (
    'scheduled',
    'completed',
    'cancelled',
    'paid'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Leave request status
DO $$ BEGIN
  CREATE TYPE leave_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Leave type
DO $$ BEGIN
  CREATE TYPE leave_type AS ENUM (
    'sick',
    'casual',
    'earned',
    'unpaid',
    'maternity',
    'paternity',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Task status
DO $$ BEGIN
  CREATE TYPE task_status AS ENUM (
    'pending',
    'in_progress',
    'submitted',
    'completed',
    'overdue',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Project priority
DO $$ BEGIN
  CREATE TYPE project_priority AS ENUM (
    'low',
    'medium',
    'high',
    'urgent'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Audit log severity
DO $$ BEGIN
  CREATE TYPE audit_severity AS ENUM (
    'info',
    'warning',
    'critical',
    'security'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Site type
DO $$ BEGIN
  CREATE TYPE site_type AS ENUM (
    'residential',
    'commercial',
    'industrial',
    'infrastructure',
    'agricultural',
    'government',
    'semi_government',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

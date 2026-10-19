-- ============================================================
-- FILE: 20260818000000_add_gis_workflows.sql
-- PURPOSE: Add workflow_type to projects and gis_design stage
-- ============================================================

-- 1. Add gis_design to project_status enum if not exists
DO $$ 
BEGIN
  ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'gis_design';
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- 2. Add workflow_type column to projects table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'projects' 
    AND column_name = 'workflow_type'
  ) THEN
    ALTER TABLE public.projects ADD COLUMN workflow_type TEXT;
  END IF;
END $$;

-- 3. Backfill existing operational projects
-- Sets default to 'topographic_survey' for projects that are past the initial sales/quotation stages
UPDATE public.projects 
SET workflow_type = 'topographic_survey'
WHERE workflow_type IS NULL 
  AND status NOT IN (
    'lead', 
    'requirement_gathering', 
    'quotation_requested', 
    'quotation_sent', 
    'payment_pending'
  );

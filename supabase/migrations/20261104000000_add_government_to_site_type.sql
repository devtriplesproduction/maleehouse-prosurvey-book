-- ============================================================
-- FILE: 20261104000000_add_government_to_site_type.sql
-- PURPOSE: Add 'government' and 'semi_government' to site_type enum
-- ============================================================

DO $$ BEGIN
  ALTER TYPE site_type ADD VALUE IF NOT EXISTS 'government';
  ALTER TYPE site_type ADD VALUE IF NOT EXISTS 'semi_government';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


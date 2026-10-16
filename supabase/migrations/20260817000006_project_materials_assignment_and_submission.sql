-- ============================================================
-- FILE: 20260817000006_project_materials_assignment_and_submission.sql
-- PURPOSE: Update material_requests into an Engineer Material/Equipment Assignment
--          and Return system where materials are assigned during team allocation
--          and must be submitted back to the company upon final deliverable.
-- ============================================================

-- 1. Update check constraint to allow 'assigned', 'submitted', 'returned'
ALTER TABLE public.material_requests DROP CONSTRAINT IF EXISTS material_requests_status_check;

ALTER TABLE public.material_requests 
  ADD CONSTRAINT material_requests_status_check 
  CHECK (status IN ('assigned', 'submitted', 'returned', 'requested', 'approved', 'delivered', 'rejected', 'lost', 'missing'));

ALTER TABLE public.material_requests 
  ALTER COLUMN status SET DEFAULT 'assigned';

-- 2. Add assignment and submission tracking columns
ALTER TABLE public.material_requests
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_material_requests_status ON public.material_requests(status);
CREATE INDEX IF NOT EXISTS idx_material_requests_assigned_to ON public.material_requests(assigned_to);

-- 4. RLS policies
DROP POLICY IF EXISTS "Admin and engineers can insert material requests" ON public.material_requests;
CREATE POLICY "Admin and engineers can insert material requests"
  ON public.material_requests FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'engineer')
    )
  );

DROP POLICY IF EXISTS "Admin and engineers can delete material requests" ON public.material_requests;
CREATE POLICY "Admin and engineers can delete material requests"
  ON public.material_requests FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'engineer')
    )
  );

DROP POLICY IF EXISTS "Assigned users can view project materials" ON public.material_requests;
CREATE POLICY "Assigned users can view project materials"
  ON public.material_requests FOR SELECT
  USING (
    assigned_to = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.project_assignments
      WHERE project_assignments.project_id = material_requests.project_id
        AND project_assignments.user_id = auth.uid()
    )
  );

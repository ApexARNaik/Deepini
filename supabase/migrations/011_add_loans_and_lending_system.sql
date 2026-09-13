-- Migration 011: Add loans and lending system with atomic leaf hotspot validation

CREATE TABLE IF NOT EXISTS loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_type TEXT NOT NULL CHECK (loan_type IN ('component', 'project')),
  component_id UUID REFERENCES components(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  source_location_id UUID REFERENCES spatial_hotspots(id) ON DELETE SET NULL,
  returned_location_id UUID REFERENCES spatial_hotspots(id) ON DELETE SET NULL,
  component_name TEXT,
  project_name TEXT,
  source_location_label TEXT,
  returned_location_label TEXT,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  borrower_name TEXT NOT NULL,
  borrower_contact TEXT,
  notes TEXT,
  lent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_date DATE NOT NULL,
  returned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure RLS is disabled and anon has access (matching Deepini single-user architecture)
ALTER TABLE loans DISABLE ROW LEVEL SECURITY;
GRANT ALL ON loans TO anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_loans_active ON loans(returned_at) WHERE returned_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_loans_due_date ON loans(due_date);
CREATE INDEX IF NOT EXISTS idx_loans_component_id ON loans(component_id);
CREATE INDEX IF NOT EXISTS idx_loans_project_id ON loans(project_id);

-- Update component_totals view to account for active loans
CREATE OR REPLACE VIEW component_totals AS
SELECT
  c.id AS component_id,
  coalesce(sum(cl.quantity), 0) AS in_storage_qty,
  coalesce((SELECT sum(pc.quantity) FROM project_components pc WHERE pc.component_id = c.id AND pc.returned_at IS NULL), 0) +
  coalesce((SELECT sum(l.quantity) FROM loans l WHERE l.component_id = c.id AND l.returned_at IS NULL), 0) AS checked_out_qty,
  coalesce(sum(cl.quantity), 0) + 
  coalesce((SELECT sum(pc.quantity) FROM project_components pc WHERE pc.component_id = c.id AND pc.returned_at IS NULL), 0) +
  coalesce((SELECT sum(l.quantity) FROM loans l WHERE l.component_id = c.id AND l.returned_at IS NULL), 0) AS total_owned_qty
FROM components c
LEFT JOIN component_locations cl ON cl.component_id = c.id
GROUP BY c.id;

-- RPC: Atomic Component Lending with Row-Level Locking and Leaf Validation
CREATE OR REPLACE FUNCTION lend_component(
  p_component_id UUID,
  p_source_location_id UUID,
  p_quantity INT,
  p_borrower_name TEXT,
  p_borrower_contact TEXT DEFAULT NULL,
  p_due_date DATE DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
) RETURNS loans AS $$
DECLARE
  v_is_leaf BOOLEAN;
  v_current_qty INT;
  v_comp_name TEXT;
  v_loc_label TEXT;
  v_loan loans;
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero.';
  END IF;

  IF p_borrower_name IS NULL OR trim(p_borrower_name) = '' THEN
    RAISE EXCEPTION 'Borrower name is required.';
  END IF;

  IF p_due_date IS NULL THEN
    RAISE EXCEPTION 'Due date is required.';
  END IF;

  -- 1. Enforce that source location exists and is a valid leaf hotspot
  SELECT is_leaf, label INTO v_is_leaf, v_loc_label
  FROM spatial_hotspots WHERE id = p_source_location_id;
  
  IF v_is_leaf IS NULL THEN
    RAISE EXCEPTION 'Source location with id % does not exist.', p_source_location_id;
  END IF;
  
  IF v_is_leaf = FALSE THEN
    RAISE EXCEPTION 'Source location must be a valid leaf storage location, not an intermediate view.';
  END IF;

  -- 2. Fetch component snapshot
  SELECT name INTO v_comp_name FROM components WHERE id = p_component_id;
  IF v_comp_name IS NULL THEN
    RAISE EXCEPTION 'Component with id % does not exist.', p_component_id;
  END IF;

  -- 3. Row lock component_locations for this component and compartment
  SELECT quantity INTO v_current_qty
  FROM component_locations
  WHERE component_id = p_component_id AND hotspot_id = p_source_location_id
  FOR UPDATE;

  IF v_current_qty IS NULL THEN
    RAISE EXCEPTION 'Component % has no stock assigned in source location %.', p_component_id, p_source_location_id;
  END IF;

  IF v_current_qty < p_quantity THEN
    RAISE EXCEPTION 'Cannot lend % units; only % units currently available in this location.', p_quantity, v_current_qty;
  END IF;

  -- 4. Atomically decrement storage quantity
  IF v_current_qty = p_quantity THEN
    DELETE FROM component_locations
    WHERE component_id = p_component_id AND hotspot_id = p_source_location_id;
  ELSE
    UPDATE component_locations
    SET quantity = quantity - p_quantity,
        updated_at = now()
    WHERE component_id = p_component_id AND hotspot_id = p_source_location_id;
  END IF;

  -- 5. Insert loan record preserving snapshot data
  INSERT INTO loans (
    loan_type,
    component_id,
    component_name,
    source_location_id,
    source_location_label,
    quantity,
    borrower_name,
    borrower_contact,
    due_date,
    notes,
    lent_at
  ) VALUES (
    'component',
    p_component_id,
    v_comp_name,
    p_source_location_id,
    v_loc_label,
    p_quantity,
    trim(p_borrower_name),
    trim(p_borrower_contact),
    p_due_date,
    trim(p_notes),
    now()
  ) RETURNING * INTO v_loan;

  RETURN v_loan;
END;
$$ LANGUAGE plpgsql;

-- RPC: Atomic Return of Lent Component (Allows returning to another valid leaf location if original is deleted)
CREATE OR REPLACE FUNCTION return_lent_component(
  p_loan_id UUID,
  p_return_location_id UUID
) RETURNS loans AS $$
DECLARE
  v_loan loans;
  v_is_leaf BOOLEAN;
  v_loc_label TEXT;
BEGIN
  SELECT * INTO v_loan FROM loans WHERE id = p_loan_id FOR UPDATE;
  
  IF v_loan.id IS NULL THEN
    RAISE EXCEPTION 'Loan record % not found.', p_loan_id;
  END IF;

  IF v_loan.returned_at IS NOT NULL THEN
    RAISE EXCEPTION 'This loan has already been marked as returned.';
  END IF;

  -- Validate return location is a leaf hotspot
  SELECT is_leaf, label INTO v_is_leaf, v_loc_label
  FROM spatial_hotspots WHERE id = p_return_location_id;

  IF v_is_leaf IS NULL THEN
    RAISE EXCEPTION 'Return location with id % does not exist.', p_return_location_id;
  END IF;

  IF v_is_leaf = FALSE THEN
    RAISE EXCEPTION 'Return location must be a valid leaf storage location.';
  END IF;

  -- If component was hard deleted in the meantime, we still record the return without crashing
  IF v_loan.component_id IS NOT NULL THEN
    INSERT INTO component_locations (component_id, hotspot_id, quantity)
    VALUES (v_loan.component_id, p_return_location_id, v_loan.quantity)
    ON CONFLICT (component_id, hotspot_id)
    DO UPDATE SET quantity = component_locations.quantity + v_loan.quantity,
                  updated_at = now();
  END IF;

  -- Update loan record with returned status
  UPDATE loans
  SET returned_at = now(),
      returned_location_id = p_return_location_id,
      returned_location_label = v_loc_label,
      updated_at = now()
  WHERE id = p_loan_id
  RETURNING * INTO v_loan;

  RETURN v_loan;
END;
$$ LANGUAGE plpgsql;

-- RPC: Atomic Project Lending
CREATE OR REPLACE FUNCTION lend_project(
  p_project_id UUID,
  p_borrower_name TEXT,
  p_borrower_contact TEXT DEFAULT NULL,
  p_due_date DATE DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
) RETURNS loans AS $$
DECLARE
  v_proj projects;
  v_loc_label TEXT;
  v_loan loans;
BEGIN
  IF p_borrower_name IS NULL OR trim(p_borrower_name) = '' THEN
    RAISE EXCEPTION 'Borrower name is required.';
  END IF;

  IF p_due_date IS NULL THEN
    RAISE EXCEPTION 'Due date is required.';
  END IF;

  SELECT * INTO v_proj FROM projects WHERE id = p_project_id FOR UPDATE;
  IF v_proj.id IS NULL THEN
    RAISE EXCEPTION 'Project % does not exist.', p_project_id;
  END IF;

  IF v_proj.status = 'planning' THEN
    RAISE EXCEPTION 'Cannot lend a project in Planning phase (no physical build or components in use).';
  END IF;

  IF v_proj.location_id IS NOT NULL THEN
    SELECT label INTO v_loc_label FROM spatial_hotspots WHERE id = v_proj.location_id;
  END IF;

  INSERT INTO loans (
    loan_type,
    project_id,
    project_name,
    source_location_id,
    source_location_label,
    quantity,
    borrower_name,
    borrower_contact,
    due_date,
    notes,
    lent_at
  ) VALUES (
    'project',
    p_project_id,
    v_proj.name,
    v_proj.location_id,
    v_loc_label,
    1,
    trim(p_borrower_name),
    trim(p_borrower_contact),
    p_due_date,
    trim(p_notes),
    now()
  ) RETURNING * INTO v_loan;

  RETURN v_loan;
END;
$$ LANGUAGE plpgsql;

-- RPC: Return Lent Project
CREATE OR REPLACE FUNCTION return_lent_project(
  p_loan_id UUID,
  p_return_location_id UUID DEFAULT NULL
) RETURNS loans AS $$
DECLARE
  v_loan loans;
  v_loc_label TEXT;
  v_is_leaf BOOLEAN;
BEGIN
  SELECT * INTO v_loan FROM loans WHERE id = p_loan_id FOR UPDATE;

  IF v_loan.id IS NULL THEN
    RAISE EXCEPTION 'Loan record % not found.', p_loan_id;
  END IF;

  IF v_loan.returned_at IS NOT NULL THEN
    RAISE EXCEPTION 'This loan has already been marked as returned.';
  END IF;

  IF p_return_location_id IS NOT NULL THEN
    SELECT is_leaf, label INTO v_is_leaf, v_loc_label
    FROM spatial_hotspots WHERE id = p_return_location_id;

    IF v_is_leaf IS NULL OR v_is_leaf = FALSE THEN
      RAISE EXCEPTION 'Return location must be a valid leaf storage location.';
    END IF;

    -- Update project location if project still exists
    IF v_loan.project_id IS NOT NULL THEN
      UPDATE projects
      SET location_id = p_return_location_id, updated_at = now()
      WHERE id = v_loan.project_id;
    END IF;
  END IF;

  UPDATE loans
  SET returned_at = now(),
      returned_location_id = p_return_location_id,
      returned_location_label = v_loc_label,
      updated_at = now()
  WHERE id = p_loan_id
  RETURNING * INTO v_loan;

  RETURN v_loan;
END;
$$ LANGUAGE plpgsql;

-- Integrated delete_component_safe checking both project_components AND active loans
CREATE OR REPLACE FUNCTION delete_component_safe(p_component_id UUID) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_active_checkouts INT;
  v_active_loans INT;
BEGIN
  SELECT count(*) INTO v_active_checkouts
  FROM project_components
  WHERE component_id = p_component_id AND returned_at IS NULL;

  SELECT count(*) INTO v_active_loans
  FROM loans
  WHERE component_id = p_component_id AND returned_at IS NULL;
  
  IF v_active_checkouts = 0 AND v_active_loans = 0 THEN
    UPDATE tags SET usage_count = GREATEST(usage_count - 1, 0)
    WHERE id IN (SELECT tag_id FROM component_tags WHERE component_id = p_component_id);
    
    DELETE FROM components WHERE id = p_component_id;
  ELSE
    DELETE FROM component_locations WHERE component_id = p_component_id;
    UPDATE components SET pending_delete = true WHERE id = p_component_id;
  END IF;
END;
$$;

-- Deepini PRD Compliance Migration
-- Safe, idempotent migration to ensure table structures, views, and RPCs match the PRD.
-- This does not drop existing data.

-- 1. BASE TABLES (IF NOT EXISTS to safely preserve production data)
-- Base definitions without inline constraints that might conflict on existing tables.

CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE rooms 
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS order_index INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE TABLE IF NOT EXISTS spatial_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID,
  parent_hotspot_id UUID,
  image_url TEXT,
  label TEXT,
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE spatial_photos 
  ADD COLUMN IF NOT EXISTS room_id UUID,
  ADD COLUMN IF NOT EXISTS parent_hotspot_id UUID,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS order_index INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE TABLE IF NOT EXISTS spatial_hotspots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID,
  label TEXT,
  shape_points JSONB,
  is_leaf BOOLEAN DEFAULT false,
  child_photo_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE spatial_hotspots 
  ADD COLUMN IF NOT EXISTS photo_id UUID,
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS shape_points JSONB,
  ADD COLUMN IF NOT EXISTS is_leaf BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS child_photo_id UUID,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE TABLE IF NOT EXISTS components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  photo_url TEXT,
  price NUMERIC,
  purchase_source TEXT,
  datasheet_link TEXT,
  low_stock_threshold INT,
  notes TEXT,
  pending_delete BOOLEAN DEFAULT false,
  custom_fields JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE components 
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS price NUMERIC,
  ADD COLUMN IF NOT EXISTS purchase_source TEXT,
  ADD COLUMN IF NOT EXISTS datasheet_link TEXT,
  ADD COLUMN IF NOT EXISTS low_stock_threshold INT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS pending_delete BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  usage_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE tags 
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS usage_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

CREATE TABLE IF NOT EXISTS component_tags (
  component_id UUID,
  tag_id UUID,
  PRIMARY KEY (component_id, tag_id)
);

CREATE TABLE IF NOT EXISTS component_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id UUID,
  hotspot_id UUID,
  quantity INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE component_locations 
  ADD COLUMN IF NOT EXISTS component_id UUID,
  ADD COLUMN IF NOT EXISTS hotspot_id UUID,
  ADD COLUMN IF NOT EXISTS quantity INT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  status TEXT DEFAULT 'planning',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE projects 
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'planning',
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE TABLE IF NOT EXISTS project_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID,
  component_id UUID,
  source_location_id UUID,
  quantity INT,
  checked_out_at TIMESTAMPTZ DEFAULT now(),
  returned_at TIMESTAMPTZ,
  returned_location_id UUID
);
ALTER TABLE project_components 
  ADD COLUMN IF NOT EXISTS project_id UUID,
  ADD COLUMN IF NOT EXISTS component_id UUID,
  ADD COLUMN IF NOT EXISTS source_location_id UUID,
  ADD COLUMN IF NOT EXISTS quantity INT,
  ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS returned_location_id UUID;


-- 2. SAFE CONSTRAINTS (NOT NULL, UNIQUE, CHECK, FOREIGN KEYS)
DO $$
DECLARE
    r RECORD;
    v_count INT;
BEGIN
    -- 0. PRE-FLIGHT DATA CHECKS
    -- Ensure no existing data violates NOT NULL constraints before applying them.
    SELECT count(*) INTO v_count FROM rooms WHERE name IS NULL OR order_index IS NULL OR created_at IS NULL OR updated_at IS NULL;
    IF v_count > 0 THEN RAISE EXCEPTION 'Preflight failed: % rooms contain NULL in required columns. Fix existing data before migrating.', v_count; END IF;

    SELECT count(*) INTO v_count FROM spatial_photos WHERE room_id IS NULL OR image_url IS NULL OR order_index IS NULL OR created_at IS NULL OR updated_at IS NULL;
    IF v_count > 0 THEN RAISE EXCEPTION 'Preflight failed: % spatial_photos contain NULL in required columns. Fix existing data before migrating.', v_count; END IF;

    SELECT count(*) INTO v_count FROM spatial_hotspots WHERE photo_id IS NULL OR label IS NULL OR shape_points IS NULL OR is_leaf IS NULL OR created_at IS NULL OR updated_at IS NULL;
    IF v_count > 0 THEN RAISE EXCEPTION 'Preflight failed: % spatial_hotspots contain NULL in required columns. Fix existing data before migrating.', v_count; END IF;

    SELECT count(*) INTO v_count FROM components WHERE name IS NULL OR pending_delete IS NULL OR custom_fields IS NULL OR created_at IS NULL OR updated_at IS NULL;
    IF v_count > 0 THEN RAISE EXCEPTION 'Preflight failed: % components contain NULL in required columns. Fix existing data before migrating.', v_count; END IF;

    SELECT count(*) INTO v_count FROM tags WHERE name IS NULL OR usage_count IS NULL OR created_at IS NULL;
    IF v_count > 0 THEN RAISE EXCEPTION 'Preflight failed: % tags contain NULL in required columns. Fix existing data before migrating.', v_count; END IF;

    SELECT count(*) INTO v_count FROM component_locations WHERE component_id IS NULL OR hotspot_id IS NULL OR quantity IS NULL OR created_at IS NULL OR updated_at IS NULL;
    IF v_count > 0 THEN RAISE EXCEPTION 'Preflight failed: % component_locations contain NULL in required columns. Fix existing data before migrating.', v_count; END IF;

    SELECT count(*) INTO v_count FROM projects WHERE name IS NULL OR status IS NULL OR created_at IS NULL OR updated_at IS NULL;
    IF v_count > 0 THEN RAISE EXCEPTION 'Preflight failed: % projects contain NULL in required columns. Fix existing data before migrating.', v_count; END IF;

    SELECT count(*) INTO v_count FROM project_components WHERE project_id IS NULL OR component_id IS NULL OR quantity IS NULL OR checked_out_at IS NULL;
    IF v_count > 0 THEN RAISE EXCEPTION 'Preflight failed: % project_components contain NULL in required columns. Fix existing data before migrating.', v_count; END IF;

    -- Pre-flight checks for UNIQUE constraints
    SELECT count(*) INTO v_count FROM (SELECT name FROM tags GROUP BY name HAVING count(*) > 1) sub;
    IF v_count > 0 THEN RAISE EXCEPTION 'Preflight failed: % duplicate tag names found. Merge tags before applying UNIQUE constraint.', v_count; END IF;

    SELECT count(*) INTO v_count FROM (SELECT component_id, hotspot_id FROM component_locations GROUP BY component_id, hotspot_id HAVING count(*) > 1) sub;
    IF v_count > 0 THEN RAISE EXCEPTION 'Preflight failed: % duplicate component_locations pairs found. Merge quantities before applying UNIQUE constraint.', v_count; END IF;

    -- Pre-flight checks for CHECK constraints
    SELECT count(*) INTO v_count FROM component_locations WHERE quantity < 0;
    IF v_count > 0 THEN RAISE EXCEPTION 'Preflight failed: % component_locations have quantity < 0. Fix before migrating.', v_count; END IF;

    SELECT count(*) INTO v_count FROM project_components WHERE quantity <= 0;
    IF v_count > 0 THEN RAISE EXCEPTION 'Preflight failed: % project_components have quantity <= 0. Fix before migrating.', v_count; END IF;

    SELECT count(*) INTO v_count FROM projects WHERE status NOT IN ('planning', 'active', 'completed', 'archived');
    IF v_count > 0 THEN RAISE EXCEPTION 'Preflight failed: % projects have invalid status. Must be planning, active, completed, or archived.', v_count; END IF;

    -- Pre-flight checks for orphaned Foreign Keys
    SELECT count(*) INTO v_count FROM spatial_photos WHERE room_id IS NOT NULL AND room_id NOT IN (SELECT id FROM rooms);
    IF v_count > 0 THEN RAISE EXCEPTION 'Preflight failed: % spatial_photos reference missing rooms.', v_count; END IF;

    SELECT count(*) INTO v_count FROM spatial_photos WHERE parent_hotspot_id IS NOT NULL AND parent_hotspot_id NOT IN (SELECT id FROM spatial_hotspots);
    IF v_count > 0 THEN RAISE EXCEPTION 'Preflight failed: % spatial_photos reference missing parent_hotspots.', v_count; END IF;

    SELECT count(*) INTO v_count FROM spatial_hotspots WHERE photo_id IS NOT NULL AND photo_id NOT IN (SELECT id FROM spatial_photos);
    IF v_count > 0 THEN RAISE EXCEPTION 'Preflight failed: % spatial_hotspots reference missing photos.', v_count; END IF;

    SELECT count(*) INTO v_count FROM spatial_hotspots WHERE child_photo_id IS NOT NULL AND child_photo_id NOT IN (SELECT id FROM spatial_photos);
    IF v_count > 0 THEN RAISE EXCEPTION 'Preflight failed: % spatial_hotspots reference missing child_photos.', v_count; END IF;

    SELECT count(*) INTO v_count FROM component_tags WHERE component_id IS NOT NULL AND component_id NOT IN (SELECT id FROM components);
    IF v_count > 0 THEN RAISE EXCEPTION 'Preflight failed: % component_tags reference missing components.', v_count; END IF;

    SELECT count(*) INTO v_count FROM component_tags WHERE tag_id IS NOT NULL AND tag_id NOT IN (SELECT id FROM tags);
    IF v_count > 0 THEN RAISE EXCEPTION 'Preflight failed: % component_tags reference missing tags.', v_count; END IF;

    SELECT count(*) INTO v_count FROM component_locations WHERE component_id IS NOT NULL AND component_id NOT IN (SELECT id FROM components);
    IF v_count > 0 THEN RAISE EXCEPTION 'Preflight failed: % component_locations reference missing components.', v_count; END IF;

    SELECT count(*) INTO v_count FROM component_locations WHERE hotspot_id IS NOT NULL AND hotspot_id NOT IN (SELECT id FROM spatial_hotspots);
    IF v_count > 0 THEN RAISE EXCEPTION 'Preflight failed: % component_locations reference missing hotspots.', v_count; END IF;

    SELECT count(*) INTO v_count FROM project_components WHERE project_id IS NOT NULL AND project_id NOT IN (SELECT id FROM projects);
    IF v_count > 0 THEN RAISE EXCEPTION 'Preflight failed: % project_components reference missing projects.', v_count; END IF;

    SELECT count(*) INTO v_count FROM project_components WHERE component_id IS NOT NULL AND component_id NOT IN (SELECT id FROM components);
    IF v_count > 0 THEN RAISE EXCEPTION 'Preflight failed: % project_components reference missing components.', v_count; END IF;

    SELECT count(*) INTO v_count FROM project_components WHERE source_location_id IS NOT NULL AND source_location_id NOT IN (SELECT id FROM spatial_hotspots);
    IF v_count > 0 THEN RAISE EXCEPTION 'Preflight failed: % project_components reference missing source_locations.', v_count; END IF;

    SELECT count(*) INTO v_count FROM project_components WHERE returned_location_id IS NOT NULL AND returned_location_id NOT IN (SELECT id FROM spatial_hotspots);
    IF v_count > 0 THEN RAISE EXCEPTION 'Preflight failed: % project_components reference missing returned_locations.', v_count; END IF;

    -- A. NOT NULL Constraints (Idempotent alterations)
    ALTER TABLE rooms ALTER COLUMN name SET NOT NULL;
    ALTER TABLE rooms ALTER COLUMN order_index SET NOT NULL;
    ALTER TABLE rooms ALTER COLUMN created_at SET NOT NULL;
    ALTER TABLE rooms ALTER COLUMN updated_at SET NOT NULL;
    
    ALTER TABLE spatial_photos ALTER COLUMN room_id SET NOT NULL;
    ALTER TABLE spatial_photos ALTER COLUMN image_url SET NOT NULL;
    ALTER TABLE spatial_photos ALTER COLUMN order_index SET NOT NULL;
    ALTER TABLE spatial_photos ALTER COLUMN created_at SET NOT NULL;
    ALTER TABLE spatial_photos ALTER COLUMN updated_at SET NOT NULL;
    
    ALTER TABLE spatial_hotspots ALTER COLUMN photo_id SET NOT NULL;
    ALTER TABLE spatial_hotspots ALTER COLUMN label SET NOT NULL;
    ALTER TABLE spatial_hotspots ALTER COLUMN shape_points SET NOT NULL;
    ALTER TABLE spatial_hotspots ALTER COLUMN is_leaf SET NOT NULL;
    ALTER TABLE spatial_hotspots ALTER COLUMN created_at SET NOT NULL;
    ALTER TABLE spatial_hotspots ALTER COLUMN updated_at SET NOT NULL;
    
    ALTER TABLE components ALTER COLUMN name SET NOT NULL;
    ALTER TABLE components ALTER COLUMN pending_delete SET NOT NULL;
    ALTER TABLE components ALTER COLUMN custom_fields SET NOT NULL;
    ALTER TABLE components ALTER COLUMN created_at SET NOT NULL;
    ALTER TABLE components ALTER COLUMN updated_at SET NOT NULL;
    
    ALTER TABLE tags ALTER COLUMN name SET NOT NULL;
    ALTER TABLE tags ALTER COLUMN usage_count SET NOT NULL;
    ALTER TABLE tags ALTER COLUMN created_at SET NOT NULL;
    
    ALTER TABLE component_locations ALTER COLUMN component_id SET NOT NULL;
    ALTER TABLE component_locations ALTER COLUMN hotspot_id SET NOT NULL;
    ALTER TABLE component_locations ALTER COLUMN quantity SET NOT NULL;
    ALTER TABLE component_locations ALTER COLUMN created_at SET NOT NULL;
    ALTER TABLE component_locations ALTER COLUMN updated_at SET NOT NULL;
    
    ALTER TABLE projects ALTER COLUMN name SET NOT NULL;
    ALTER TABLE projects ALTER COLUMN status SET NOT NULL;
    ALTER TABLE projects ALTER COLUMN created_at SET NOT NULL;
    ALTER TABLE projects ALTER COLUMN updated_at SET NOT NULL;
    
    ALTER TABLE project_components ALTER COLUMN project_id SET NOT NULL;
    ALTER TABLE project_components ALTER COLUMN component_id SET NOT NULL;
    ALTER TABLE project_components ALTER COLUMN quantity SET NOT NULL;
    ALTER TABLE project_components ALTER COLUMN checked_out_at SET NOT NULL;
    -- Note: source_location_id & returned_location_id are intentionally nullable to preserve history on spatial deletion.

    -- B. UNIQUE CONSTRAINTS
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tags_name_key') THEN
        ALTER TABLE tags ADD CONSTRAINT tags_name_key UNIQUE (name);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'component_locations_component_id_hotspot_id_key') THEN
        ALTER TABLE component_locations ADD CONSTRAINT component_locations_component_id_hotspot_id_key UNIQUE (component_id, hotspot_id);
    END IF;

    -- C. CHECK CONSTRAINTS
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_component_locations_quantity') THEN
        ALTER TABLE component_locations ADD CONSTRAINT chk_component_locations_quantity CHECK (quantity >= 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_project_components_quantity') THEN
        ALTER TABLE project_components ADD CONSTRAINT chk_project_components_quantity CHECK (quantity > 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_projects_status') THEN
        ALTER TABLE projects ADD CONSTRAINT chk_projects_status CHECK (status IN ('planning', 'active', 'completed', 'archived'));
    END IF;

    -- D. FOREIGN KEYS (Cascading structure setup)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_spatial_photos_room') THEN
        ALTER TABLE spatial_photos ADD CONSTRAINT fk_spatial_photos_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_spatial_photos_parent_hotspot') THEN
        ALTER TABLE spatial_photos ADD CONSTRAINT fk_spatial_photos_parent_hotspot FOREIGN KEY (parent_hotspot_id) REFERENCES spatial_hotspots(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_spatial_hotspots_photo') THEN
        ALTER TABLE spatial_hotspots ADD CONSTRAINT fk_spatial_hotspots_photo FOREIGN KEY (photo_id) REFERENCES spatial_photos(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_spatial_hotspots_child_photo') THEN
        ALTER TABLE spatial_hotspots ADD CONSTRAINT fk_spatial_hotspots_child_photo FOREIGN KEY (child_photo_id) REFERENCES spatial_photos(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_component_tags_component') THEN
        ALTER TABLE component_tags ADD CONSTRAINT fk_component_tags_component FOREIGN KEY (component_id) REFERENCES components(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_component_tags_tag') THEN
        ALTER TABLE component_tags ADD CONSTRAINT fk_component_tags_tag FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_component_locations_component') THEN
        ALTER TABLE component_locations ADD CONSTRAINT fk_component_locations_component FOREIGN KEY (component_id) REFERENCES components(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_component_locations_hotspot') THEN
        ALTER TABLE component_locations ADD CONSTRAINT fk_component_locations_hotspot FOREIGN KEY (hotspot_id) REFERENCES spatial_hotspots(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_project_components_project') THEN
        ALTER TABLE project_components ADD CONSTRAINT fk_project_components_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_project_components_component') THEN
        ALTER TABLE project_components ADD CONSTRAINT fk_project_components_component FOREIGN KEY (component_id) REFERENCES components(id) ON DELETE CASCADE;
    END IF;

    -- Fix project_components referencing spatial_hotspots to allow ON DELETE SET NULL
    -- This prevents spatial deletion from destroying historical checkout records or blocking deletion.
    FOR r IN (
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'project_components'::regclass 
          AND confrelid = 'spatial_hotspots'::regclass
          AND conname NOT IN ('fk_project_components_source_loc', 'fk_project_components_returned_loc')
    ) LOOP
        EXECUTE 'ALTER TABLE project_components DROP CONSTRAINT ' || r.conname;
    END LOOP;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_project_components_source_loc') THEN
        ALTER TABLE project_components ADD CONSTRAINT fk_project_components_source_loc FOREIGN KEY (source_location_id) REFERENCES spatial_hotspots(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_project_components_returned_loc') THEN
        ALTER TABLE project_components ADD CONSTRAINT fk_project_components_returned_loc FOREIGN KEY (returned_location_id) REFERENCES spatial_hotspots(id) ON DELETE SET NULL;
    END IF;

END $$;

-- 3. COMPONENT TOTALS VIEW (Always safe to replace)
CREATE OR REPLACE VIEW component_totals AS
SELECT
  c.id AS component_id,
  coalesce(sum(cl.quantity), 0) AS in_storage_qty,
  coalesce((SELECT sum(pc.quantity) FROM project_components pc WHERE pc.component_id = c.id AND pc.returned_at IS NULL), 0) AS checked_out_qty,
  coalesce(sum(cl.quantity), 0) + coalesce((SELECT sum(pc.quantity) FROM project_components pc WHERE pc.component_id = c.id AND pc.returned_at IS NULL), 0) AS total_owned_qty
FROM components c
LEFT JOIN component_locations cl ON cl.component_id = c.id
GROUP BY c.id;

-- 4. ATOMIC RPCS

-- RPC Checkout Function
CREATE OR REPLACE FUNCTION checkout_component(
  p_project_id UUID,
  p_component_id UUID,
  p_source_location_id UUID,
  p_quantity INT
) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_current_qty INT;
  v_project_component_id UUID;
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Checkout quantity must be greater than 0';
  END IF;

  -- Lock row for safety
  SELECT quantity INTO v_current_qty FROM component_locations 
  WHERE component_id = p_component_id AND hotspot_id = p_source_location_id FOR UPDATE;
  
  -- Check availability
  IF NOT FOUND OR v_current_qty < p_quantity THEN
    RAISE EXCEPTION 'Insufficient quantity at source location';
  END IF;
  
  -- Mutate location qty
  IF v_current_qty = p_quantity THEN
    DELETE FROM component_locations WHERE component_id = p_component_id AND hotspot_id = p_source_location_id;
  ELSE
    UPDATE component_locations SET quantity = quantity - p_quantity, updated_at = now() 
    WHERE component_id = p_component_id AND hotspot_id = p_source_location_id;
  END IF;
  
  -- Insert checkout log
  INSERT INTO project_components (project_id, component_id, source_location_id, quantity)
  VALUES (p_project_id, p_component_id, p_source_location_id, p_quantity)
  RETURNING id INTO v_project_component_id;
  
  RETURN v_project_component_id;
END;
$$;

-- RPC Checkin Function
CREATE OR REPLACE FUNCTION checkin_component(
  p_project_component_id UUID,
  p_return_location_id UUID
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_component_id UUID;
  v_quantity INT;
  v_pending_delete BOOLEAN;
  v_active_checkouts INT;
  v_is_leaf BOOLEAN;
BEGIN
  -- Validate return location is a leaf
  SELECT is_leaf INTO v_is_leaf FROM spatial_hotspots WHERE id = p_return_location_id;
  IF NOT FOUND OR NOT v_is_leaf THEN
    RAISE EXCEPTION 'Return location must be a valid leaf hotspot';
  END IF;

  -- Lock project_components row and get details
  SELECT component_id, quantity INTO v_component_id, v_quantity 
  FROM project_components 
  WHERE id = p_project_component_id AND returned_at IS NULL FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project component not found or already returned';
  END IF;
  
  -- Update project_components history
  UPDATE project_components 
  SET returned_at = now(), returned_location_id = p_return_location_id 
  WHERE id = p_project_component_id;
  
  -- Upsert component_locations inventory
  INSERT INTO component_locations (component_id, hotspot_id, quantity)
  VALUES (v_component_id, p_return_location_id, v_quantity)
  ON CONFLICT (component_id, hotspot_id) 
  DO UPDATE SET quantity = component_locations.quantity + v_quantity, updated_at = now();
  
  -- Check pending_delete cascade
  SELECT pending_delete INTO v_pending_delete FROM components WHERE id = v_component_id;
  
  IF v_pending_delete THEN
    SELECT count(*) INTO v_active_checkouts FROM project_components 
    WHERE component_id = v_component_id AND returned_at IS NULL;
    
    IF v_active_checkouts = 0 THEN
      -- Decrement tags usage_count before hard deleting the component (since component_tags CASCADE deletes)
      UPDATE tags SET usage_count = GREATEST(usage_count - 1, 0)
      WHERE id IN (SELECT tag_id FROM component_tags WHERE component_id = v_component_id);
      
      DELETE FROM components WHERE id = v_component_id;
    END IF;
  END IF;
END;
$$;

-- RPC: Upsert Component Full
CREATE OR REPLACE FUNCTION upsert_component_full(
  p_id UUID,
  p_name TEXT,
  p_photo_url TEXT,
  p_price NUMERIC,
  p_purchase_source TEXT,
  p_datasheet_link TEXT,
  p_low_stock_threshold INT,
  p_notes TEXT,
  p_custom_fields JSONB,
  p_tag_ids UUID[],
  p_locations JSONB -- '[{"hotspot_id": "...", "quantity": 1}]'
) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_component_id UUID;
  v_tag_id UUID;
  v_loc JSONB;
BEGIN
  -- Insert or Update Component
  IF p_id IS NULL THEN
    INSERT INTO components (name, photo_url, price, purchase_source, datasheet_link, low_stock_threshold, notes, custom_fields)
    VALUES (p_name, p_photo_url, p_price, p_purchase_source, p_datasheet_link, p_low_stock_threshold, p_notes, p_custom_fields)
    RETURNING id INTO v_component_id;
  ELSE
    UPDATE components SET
      name = p_name,
      photo_url = p_photo_url,
      price = p_price,
      purchase_source = p_purchase_source,
      datasheet_link = p_datasheet_link,
      low_stock_threshold = p_low_stock_threshold,
      notes = p_notes,
      custom_fields = p_custom_fields,
      updated_at = now()
    WHERE id = p_id
    RETURNING id INTO v_component_id;
  END IF;

  -- Tags (usage_count maintenance)
  UPDATE tags SET usage_count = GREATEST(usage_count - 1, 0)
  WHERE id IN (SELECT tag_id FROM component_tags WHERE component_id = v_component_id);
  
  DELETE FROM component_tags WHERE component_id = v_component_id;
  
  IF p_tag_ids IS NOT NULL AND array_length(p_tag_ids, 1) > 0 THEN
    FOREACH v_tag_id IN ARRAY p_tag_ids
    LOOP
      INSERT INTO component_tags (component_id, tag_id) VALUES (v_component_id, v_tag_id);
      UPDATE tags SET usage_count = usage_count + 1 WHERE id = v_tag_id;
    END LOOP;
  END IF;

  -- Locations
  DELETE FROM component_locations WHERE component_id = v_component_id;
  
  IF p_locations IS NOT NULL AND jsonb_array_length(p_locations) > 0 THEN
    FOR v_loc IN SELECT * FROM jsonb_array_elements(p_locations)
    LOOP
      INSERT INTO component_locations (component_id, hotspot_id, quantity)
      VALUES (v_component_id, (v_loc->>'hotspot_id')::UUID, (v_loc->>'quantity')::INT);
    END LOOP;
  END IF;

  RETURN v_component_id;
END;
$$;

-- RPC: Delete Component Safe
CREATE OR REPLACE FUNCTION delete_component_safe(p_component_id UUID) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_active_count INT;
BEGIN
  SELECT count(*) INTO v_active_count FROM project_components WHERE component_id = p_component_id AND returned_at IS NULL;
  
  IF v_active_count = 0 THEN
    UPDATE tags SET usage_count = GREATEST(usage_count - 1, 0)
    WHERE id IN (SELECT tag_id FROM component_tags WHERE component_id = p_component_id);
    
    DELETE FROM components WHERE id = p_component_id;
  ELSE
    DELETE FROM component_locations WHERE component_id = p_component_id;
    UPDATE components SET pending_delete = true WHERE id = p_component_id;
  END IF;
END;
$$;

-- RPC: Recursive spatial deletions
CREATE OR REPLACE FUNCTION delete_spatial_photo_recursive(p_photo_id UUID) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_hotspot_id UUID;
  v_child_photo_id UUID;
BEGIN
  FOR v_hotspot_id, v_child_photo_id IN SELECT id, child_photo_id FROM spatial_hotspots WHERE photo_id = p_photo_id
  LOOP
    IF v_child_photo_id IS NOT NULL THEN
      PERFORM delete_spatial_photo_recursive(v_child_photo_id);
    END IF;
  END LOOP;
  
  DELETE FROM spatial_photos WHERE id = p_photo_id;
END;
$$;

CREATE OR REPLACE FUNCTION delete_room_recursive(p_room_id UUID) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_photo_id UUID;
BEGIN
  FOR v_photo_id IN SELECT id FROM spatial_photos WHERE room_id = p_room_id AND parent_hotspot_id IS NULL
  LOOP
    PERFORM delete_spatial_photo_recursive(v_photo_id);
  END LOOP;
  
  DELETE FROM rooms WHERE id = p_room_id;
END;
$$;

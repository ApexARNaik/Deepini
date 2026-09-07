-- Migration: 007_spatial_undo_rpcs.sql
-- Description: Atomic PostgreSQL functions for reverting spatial operations (Undo)
-- Guarantees atomic execution and row-level locking for multi-table/multi-record mutations.

-- 1. Atomically revert intermediate view insertion
CREATE OR REPLACE FUNCTION undo_insert_intermediate_spatial_photo(
  p_parent_hotspot_id UUID,
  p_intermediate_photo_id UUID,
  p_intermediate_hotspot_id UUID,
  p_child_photo_id UUID
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_parent_hotspot RECORD;
  v_child_photo RECORD;
  v_intermediate_photo RECORD;
  v_intermediate_hotspot RECORD;
BEGIN
  -- Row-level locks on all involved entities
  SELECT id, child_photo_id INTO v_parent_hotspot
  FROM spatial_hotspots WHERE id = p_parent_hotspot_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parent hotspot % not found for undo', p_parent_hotspot_id;
  END IF;

  SELECT id, parent_hotspot_id INTO v_child_photo
  FROM spatial_photos WHERE id = p_child_photo_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Child photo % not found for undo', p_child_photo_id;
  END IF;

  SELECT id, parent_hotspot_id INTO v_intermediate_photo
  FROM spatial_photos WHERE id = p_intermediate_photo_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Intermediate photo % not found for undo', p_intermediate_photo_id;
  END IF;

  SELECT id, photo_id, child_photo_id INTO v_intermediate_hotspot
  FROM spatial_hotspots WHERE id = p_intermediate_hotspot_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Intermediate hotspot % not found for undo', p_intermediate_hotspot_id;
  END IF;

  -- Validate intermediate linkage
  IF v_parent_hotspot.child_photo_id IS DISTINCT FROM p_intermediate_photo_id THEN
    RAISE EXCEPTION 'Cannot undo: parent hotspot child is not the expected intermediate photo';
  END IF;

  IF v_child_photo.parent_hotspot_id IS DISTINCT FROM p_intermediate_hotspot_id THEN
    RAISE EXCEPTION 'Cannot undo: child photo parent is not the expected intermediate hotspot';
  END IF;

  -- Revert child photo parent to parent hotspot
  UPDATE spatial_photos
  SET parent_hotspot_id = p_parent_hotspot_id,
      updated_at = now()
  WHERE id = p_child_photo_id;

  -- Revert parent hotspot child to child photo
  UPDATE spatial_hotspots
  SET child_photo_id = p_child_photo_id,
      updated_at = now()
  WHERE id = p_parent_hotspot_id;

  -- Delete intermediate hotspot and photo
  DELETE FROM spatial_hotspots WHERE id = p_intermediate_hotspot_id;
  DELETE FROM spatial_photos WHERE id = p_intermediate_photo_id;

  RETURN json_build_object('success', true);
END;
$$;

-- 2. Atomically revert image replacement and restore previous hotspot coordinates
CREATE OR REPLACE FUNCTION undo_replace_spatial_photo(
  p_photo_id UUID,
  p_previous_image_url TEXT,
  p_hotspots_updates JSONB DEFAULT '[]'::jsonb
) RETURNS JSONB LANGUAGE plpgsql AS $$
BEGIN
  -- Lock photo row
  PERFORM 1 FROM spatial_photos WHERE id = p_photo_id FOR UPDATE;

  -- Revert image_url
  UPDATE spatial_photos
  SET image_url = p_previous_image_url,
      updated_at = now()
  WHERE id = p_photo_id;

  -- Revert hotspot points if any were adjusted/clamped
  IF jsonb_array_length(p_hotspots_updates) > 0 THEN
    UPDATE spatial_hotspots AS sh
    SET shape_points = (elem->>'shape_points')::jsonb,
        updated_at = now()
    FROM jsonb_array_elements(p_hotspots_updates) AS elem
    WHERE sh.id = (elem->>'id')::uuid;
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

-- 3. Atomically batch update hotspot shape coordinates
CREATE OR REPLACE FUNCTION batch_update_hotspot_points(
  p_updates JSONB
) RETURNS JSONB LANGUAGE plpgsql AS $$
BEGIN
  IF jsonb_array_length(p_updates) > 0 THEN
    UPDATE spatial_hotspots AS sh
    SET shape_points = (elem->>'shape_points')::jsonb,
        updated_at = now()
    FROM jsonb_array_elements(p_updates) AS elem
    WHERE sh.id = (elem->>'id')::uuid;
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

-- 4. Atomically restore a deleted hotspot and its component locations
CREATE OR REPLACE FUNCTION restore_deleted_hotspot(
  p_hotspot JSONB,
  p_component_locations JSONB DEFAULT '[]'::jsonb
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_hotspot_id UUID;
  v_child_photo_id UUID;
BEGIN
  v_hotspot_id := (p_hotspot->>'id')::uuid;
  v_child_photo_id := (p_hotspot->>'child_photo_id')::uuid;

  -- Insert hotspot with original UUID and attributes
  INSERT INTO spatial_hotspots (
    id,
    photo_id,
    label,
    shape_points,
    is_leaf,
    child_photo_id,
    created_at,
    updated_at
  ) VALUES (
    v_hotspot_id,
    (p_hotspot->>'photo_id')::uuid,
    p_hotspot->>'label',
    (p_hotspot->>'shape_points')::jsonb,
    (p_hotspot->>'is_leaf')::boolean,
    v_child_photo_id,
    COALESCE((p_hotspot->>'created_at')::timestamptz, now()),
    now()
  );

  -- Re-insert component locations if any
  IF jsonb_array_length(p_component_locations) > 0 THEN
    INSERT INTO component_locations (hotspot_id, component_id, quantity)
    SELECT
      v_hotspot_id,
      (elem->>'component_id')::uuid,
      (elem->>'quantity')::int
    FROM jsonb_array_elements(p_component_locations) AS elem;
  END IF;

  -- If it had a child photo, restore child photo parent pointer
  IF v_child_photo_id IS NOT NULL THEN
    UPDATE spatial_photos
    SET parent_hotspot_id = v_hotspot_id,
        updated_at = now()
    WHERE id = v_child_photo_id;
  END IF;

  RETURN json_build_object('success', true, 'hotspot_id', v_hotspot_id);
END;
$$;

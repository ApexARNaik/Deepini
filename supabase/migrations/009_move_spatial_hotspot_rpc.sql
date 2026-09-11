-- Migration: 009_move_spatial_hotspot_rpc.sql
-- Description: Atomically move a spatial hotspot and its children to another view/room with cycle prevention and hierarchy validation.

CREATE OR REPLACE FUNCTION move_spatial_hotspot(
  p_hotspot_id UUID,
  p_new_photo_id UUID,
  p_new_shape_points JSONB
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_hotspot RECORD;
  v_source_photo RECORD;
  v_dest_photo RECORD;
  v_child_photo RECORD;
  v_is_descendant BOOLEAN := false;
BEGIN
  -- 1. Lock and validate the hotspot
  SELECT id, photo_id, label, is_leaf, child_photo_id
  INTO v_hotspot
  FROM spatial_hotspots
  WHERE id = p_hotspot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hotspot % not found', p_hotspot_id;
  END IF;

  -- 2. Validate current source photo
  SELECT id, room_id
  INTO v_source_photo
  FROM spatial_photos
  WHERE id = v_hotspot.photo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source photo % not found for hotspot %', v_hotspot.photo_id, p_hotspot_id;
  END IF;

  -- 3. Lock and validate destination photo and room
  SELECT id, room_id
  INTO v_dest_photo
  FROM spatial_photos
  WHERE id = p_new_photo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Destination photo % not found', p_new_photo_id;
  END IF;

  IF v_dest_photo.room_id IS NULL OR NOT EXISTS (SELECT 1 FROM rooms WHERE id = v_dest_photo.room_id) THEN
    RAISE EXCEPTION 'Destination photo % does not belong to a valid room', p_new_photo_id;
  END IF;

  -- 4. Constraint: Cannot move onto the same source view
  IF v_hotspot.photo_id = p_new_photo_id THEN
    RAISE EXCEPTION 'Cannot move hotspot onto the same source view %', p_new_photo_id;
  END IF;

  -- 5. Validate parent_hotspot_id relationship consistency
  -- If hotspot links to a child photo, verify the child photo points back to this hotspot
  IF v_hotspot.child_photo_id IS NOT NULL THEN
    SELECT id, parent_hotspot_id INTO v_child_photo
    FROM spatial_photos
    WHERE id = v_hotspot.child_photo_id
    FOR UPDATE;

    IF FOUND AND v_child_photo.parent_hotspot_id IS NOT NULL AND v_child_photo.parent_hotspot_id IS DISTINCT FROM p_hotspot_id THEN
      RAISE EXCEPTION 'Inconsistent hierarchy: child photo % has parent_hotspot_id %, expected %',
        v_child_photo.id, v_child_photo.parent_hotspot_id, p_hotspot_id;
    END IF;
  END IF;

  -- 6. Constraint: Destination cannot be any descendant of the moved hotspot (Cycle prevention)
  WITH RECURSIVE descendant_photos AS (
    -- Direct child photos of the moved hotspot
    SELECT id
    FROM spatial_photos
    WHERE parent_hotspot_id = p_hotspot_id
       OR (v_hotspot.child_photo_id IS NOT NULL AND id = v_hotspot.child_photo_id)
    UNION ALL
    -- Nested descendant child photos
    SELECT sp.id
    FROM spatial_photos sp
    INNER JOIN spatial_hotspots sh ON (sp.parent_hotspot_id = sh.id OR sp.id = sh.child_photo_id)
    INNER JOIN descendant_photos dp ON sh.photo_id = dp.id
  )
  SELECT EXISTS (
    SELECT 1 FROM descendant_photos WHERE id = p_new_photo_id
  ) INTO v_is_descendant;

  IF v_is_descendant THEN
    RAISE EXCEPTION 'Destination photo % is a descendant of hotspot %; cyclic move rejected', p_new_photo_id, p_hotspot_id;
  END IF;

  -- 7. Atomically update descendant photos room_id if moving across rooms
  IF v_source_photo.room_id IS DISTINCT FROM v_dest_photo.room_id THEN
    WITH RECURSIVE descendant_photos AS (
      SELECT id
      FROM spatial_photos
      WHERE parent_hotspot_id = p_hotspot_id
         OR (v_hotspot.child_photo_id IS NOT NULL AND id = v_hotspot.child_photo_id)
      UNION ALL
      SELECT sp.id
      FROM spatial_photos sp
      INNER JOIN spatial_hotspots sh ON (sp.parent_hotspot_id = sh.id OR sp.id = sh.child_photo_id)
      INNER JOIN descendant_photos dp ON sh.photo_id = dp.id
    )
    UPDATE spatial_photos
    SET room_id = v_dest_photo.room_id,
        updated_at = now()
    WHERE id IN (SELECT id FROM descendant_photos);
  END IF;

  -- 8. Update the hotspot's photo_id and shape_points
  UPDATE spatial_hotspots
  SET photo_id = p_new_photo_id,
      shape_points = p_new_shape_points,
      updated_at = now()
  WHERE id = p_hotspot_id;

  RETURN json_build_object(
    'success', true,
    'hotspot_id', p_hotspot_id,
    'source_photo_id', v_source_photo.id,
    'source_room_id', v_source_photo.room_id,
    'destination_photo_id', v_dest_photo.id,
    'destination_room_id', v_dest_photo.room_id
  );
END;
$$;

-- Undo operation reuses the validated atomic move logic
CREATE OR REPLACE FUNCTION undo_move_spatial_hotspot(
  p_hotspot_id UUID,
  p_original_photo_id UUID,
  p_original_shape_points JSONB
) RETURNS JSONB LANGUAGE plpgsql AS $$
BEGIN
  RETURN move_spatial_hotspot(p_hotspot_id, p_original_photo_id, p_original_shape_points);
END;
$$;

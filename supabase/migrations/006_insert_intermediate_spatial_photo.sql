-- Migration: 006_insert_intermediate_spatial_photo.sql
-- Description: Atomically inserts an intermediate spatial photo and hotspot between an existing parent drilldown hotspot and its child photo.
-- Locks both Hotspot1 and Image3 with FOR UPDATE and strictly verifies their bidirectional relationship before modifying.

CREATE OR REPLACE FUNCTION insert_intermediate_spatial_photo(
  p_room_id UUID,
  p_parent_hotspot_id UUID,
  p_child_photo_id UUID,
  p_image_url TEXT,
  p_photo_label TEXT,
  p_hotspot_label TEXT,
  p_shape_points JSONB DEFAULT '[{"x":0.15,"y":0.15},{"x":0.85,"y":0.15},{"x":0.85,"y":0.85},{"x":0.15,"y":0.85}]'::jsonb
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_parent_hotspot RECORD;
  v_child_photo RECORD;
  v_new_photo_id UUID;
  v_new_hotspot_id UUID;
BEGIN
  -- 1. Row-level lock and validate parent hotspot (Hotspot1)
  SELECT id, photo_id, child_photo_id, is_leaf INTO v_parent_hotspot
  FROM spatial_hotspots
  WHERE id = p_parent_hotspot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parent hotspot % not found', p_parent_hotspot_id;
  END IF;

  -- 2. Row-level lock and validate child photo (Image3)
  SELECT id, room_id, parent_hotspot_id INTO v_child_photo
  FROM spatial_photos
  WHERE id = p_child_photo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Child photo % not found', p_child_photo_id;
  END IF;

  -- 3. Strict verification of the relationship between Hotspot1 and Image3:
  -- Verify Image3.parent_hotspot_id = Hotspot1.id
  IF v_child_photo.parent_hotspot_id IS DISTINCT FROM p_parent_hotspot_id THEN
    RAISE EXCEPTION 'Hierarchy mismatch: child photo % has parent_hotspot_id %, expected %',
      p_child_photo_id, v_child_photo.parent_hotspot_id, p_parent_hotspot_id;
  END IF;

  -- Verify Hotspot1.child_photo_id = Image3.id
  IF v_parent_hotspot.child_photo_id IS DISTINCT FROM p_child_photo_id THEN
    RAISE EXCEPTION 'Hierarchy mismatch: parent hotspot % has child_photo_id %, expected %',
      p_parent_hotspot_id, v_parent_hotspot.child_photo_id, p_child_photo_id;
  END IF;

  -- 4. Create the new intermediate photo (Image2) linked to Hotspot1
  INSERT INTO spatial_photos (room_id, parent_hotspot_id, image_url, label, order_index)
  VALUES (p_room_id, p_parent_hotspot_id, p_image_url, p_photo_label, 0)
  RETURNING id INTO v_new_photo_id;

  -- 5. Create the new hotspot on Image2 (Hotspot2) pointing to Image3
  INSERT INTO spatial_hotspots (photo_id, label, shape_points, is_leaf, child_photo_id)
  VALUES (v_new_photo_id, p_hotspot_label, p_shape_points, false, p_child_photo_id)
  RETURNING id INTO v_new_hotspot_id;

  -- 6. Update Image3 to point to Hotspot2 as its parent
  UPDATE spatial_photos
  SET parent_hotspot_id = v_new_hotspot_id,
      updated_at = now()
  WHERE id = p_child_photo_id;

  -- 7. Update Hotspot1 to point to Image2 as its child
  UPDATE spatial_hotspots
  SET child_photo_id = v_new_photo_id,
      updated_at = now()
  WHERE id = p_parent_hotspot_id;

  RETURN json_build_object(
    'photo_id', v_new_photo_id,
    'hotspot_id', v_new_hotspot_id
  );
END;
$$;

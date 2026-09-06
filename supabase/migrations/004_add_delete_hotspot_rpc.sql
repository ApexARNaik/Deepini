-- Migration: 004_add_delete_hotspot_rpc.sql
-- Function to safely and recursively delete a hotspot, its component locations, and any child photos/sub-trees

CREATE OR REPLACE FUNCTION delete_hotspot_recursive(p_hotspot_id UUID) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_child_photo_id UUID;
BEGIN
  -- 1. If this hotspot has a child photo (drill-down), recursively delete that child photo and its entire sub-tree
  SELECT child_photo_id INTO v_child_photo_id FROM spatial_hotspots WHERE id = p_hotspot_id;
  IF v_child_photo_id IS NOT NULL THEN
    PERFORM delete_spatial_photo_recursive(v_child_photo_id);
  END IF;

  -- Also check if any photo has parent_hotspot_id pointing to this hotspot
  FOR v_child_photo_id IN SELECT id FROM spatial_photos WHERE parent_hotspot_id = p_hotspot_id
  LOOP
    PERFORM delete_spatial_photo_recursive(v_child_photo_id);
  END LOOP;

  -- 2. Remove any component location links assigned to this hotspot
  DELETE FROM component_locations WHERE hotspot_id = p_hotspot_id;

  -- 3. Delete the hotspot itself
  DELETE FROM spatial_hotspots WHERE id = p_hotspot_id;
END;
$$;

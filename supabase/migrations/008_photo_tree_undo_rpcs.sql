-- Migration: 008_photo_tree_undo_rpcs.sql
-- Description: RPCs to serialize and atomically restore spatial photo trees for view deletion undo.

-- 1. Recursively serialize a photo and its entire sub-tree (photos, hotspots, component locations)
CREATE OR REPLACE FUNCTION serialize_spatial_photo_tree(p_photo_id UUID)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_photos JSONB;
  v_hotspots JSONB;
  v_component_locations JSONB;
BEGIN
  -- Find all photos in sub-tree
  WITH RECURSIVE photo_tree AS (
    SELECT id, room_id, parent_hotspot_id, image_url, label, order_index, created_at, updated_at
    FROM spatial_photos
    WHERE id = p_photo_id
    UNION ALL
    SELECT sp.id, sp.room_id, sp.parent_hotspot_id, sp.image_url, sp.label, sp.order_index, sp.created_at, sp.updated_at
    FROM spatial_photos sp
    INNER JOIN spatial_hotspots sh ON sp.parent_hotspot_id = sh.id
    INNER JOIN photo_tree pt ON sh.photo_id = pt.id
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(pt.*)), '[]'::jsonb)
  INTO v_photos
  FROM photo_tree pt;

  -- Find all hotspots on those photos
  WITH RECURSIVE photo_tree AS (
    SELECT id
    FROM spatial_photos
    WHERE id = p_photo_id
    UNION ALL
    SELECT sp.id
    FROM spatial_photos sp
    INNER JOIN spatial_hotspots sh ON sp.parent_hotspot_id = sh.id
    INNER JOIN photo_tree pt ON sh.photo_id = pt.id
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(sh.*)), '[]'::jsonb)
  INTO v_hotspots
  FROM spatial_hotspots sh
  WHERE sh.photo_id IN (SELECT id FROM photo_tree);

  -- Find all component locations for those hotspots
  WITH RECURSIVE photo_tree AS (
    SELECT id
    FROM spatial_photos
    WHERE id = p_photo_id
    UNION ALL
    SELECT sp.id
    FROM spatial_photos sp
    INNER JOIN spatial_hotspots sh ON sp.parent_hotspot_id = sh.id
    INNER JOIN photo_tree pt ON sh.photo_id = pt.id
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(cl.*)), '[]'::jsonb)
  INTO v_component_locations
  FROM component_locations cl
  WHERE cl.hotspot_id IN (
    SELECT sh.id FROM spatial_hotspots sh WHERE sh.photo_id IN (SELECT id FROM photo_tree)
  );

  RETURN json_build_object(
    'photos', v_photos,
    'hotspots', v_hotspots,
    'component_locations', v_component_locations
  );
END;
$$;

-- 2. Atomically restore a deleted spatial photo tree
CREATE OR REPLACE FUNCTION restore_deleted_spatial_photo_tree(
  p_tree JSONB,
  p_parent_hotspot_id UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_root_photo_id UUID;
BEGIN
  -- A. Re-insert all photos in the tree
  INSERT INTO spatial_photos (
    id,
    room_id,
    parent_hotspot_id,
    image_url,
    label,
    order_index,
    created_at,
    updated_at
  )
  SELECT
    (elem->>'id')::uuid,
    (elem->>'room_id')::uuid,
    CASE WHEN elem->>'parent_hotspot_id' IS NULL THEN NULL ELSE (elem->>'parent_hotspot_id')::uuid END,
    elem->>'image_url',
    elem->>'label',
    (elem->>'order_index')::int,
    COALESCE((elem->>'created_at')::timestamptz, now()),
    now()
  FROM jsonb_array_elements(p_tree->'photos') AS elem
  ON CONFLICT (id) DO UPDATE
  SET image_url = EXCLUDED.image_url,
      label = EXCLUDED.label,
      updated_at = now();

  -- B. Re-insert all hotspots in the tree
  INSERT INTO spatial_hotspots (
    id,
    photo_id,
    label,
    shape_points,
    is_leaf,
    child_photo_id,
    created_at,
    updated_at
  )
  SELECT
    (elem->>'id')::uuid,
    (elem->>'photo_id')::uuid,
    elem->>'label',
    (elem->>'shape_points')::jsonb,
    (elem->>'is_leaf')::boolean,
    CASE WHEN elem->>'child_photo_id' IS NULL THEN NULL ELSE (elem->>'child_photo_id')::uuid END,
    COALESCE((elem->>'created_at')::timestamptz, now()),
    now()
  FROM jsonb_array_elements(p_tree->'hotspots') AS elem
  ON CONFLICT (id) DO UPDATE
  SET label = EXCLUDED.label,
      shape_points = EXCLUDED.shape_points,
      is_leaf = EXCLUDED.is_leaf,
      child_photo_id = EXCLUDED.child_photo_id,
      updated_at = now();

  -- C. Re-insert all component locations
  IF jsonb_array_length(p_tree->'component_locations') > 0 THEN
    INSERT INTO component_locations (hotspot_id, component_id, quantity, created_at, updated_at)
    SELECT
      (elem->>'hotspot_id')::uuid,
      (elem->>'component_id')::uuid,
      (elem->>'quantity')::int,
      COALESCE((elem->>'created_at')::timestamptz, now()),
      now()
    FROM jsonb_array_elements(p_tree->'component_locations') AS elem
    ON CONFLICT (component_id, hotspot_id) DO UPDATE
    SET quantity = EXCLUDED.quantity,
        updated_at = now();
  END IF;

  -- D. If this tree was rooted under a parent hotspot, re-link that parent hotspot
  IF p_parent_hotspot_id IS NOT NULL AND jsonb_array_length(p_tree->'photos') > 0 THEN
    v_root_photo_id := (p_tree->'photos'->0->>'id')::uuid;
    UPDATE spatial_hotspots
    SET child_photo_id = v_root_photo_id,
        updated_at = now()
    WHERE id = p_parent_hotspot_id;
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

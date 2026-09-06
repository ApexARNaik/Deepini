-- Migration: 002_reorder_spatial_photos.sql
-- Description: Atomically reorders spatial photos by their IDs in a single transaction

CREATE OR REPLACE FUNCTION reorder_spatial_photos(
  p_photo_ids UUID[]
) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE spatial_photos AS sp
  SET order_index = ord.idx - 1,
      updated_at = now()
  FROM unnest(p_photo_ids) WITH ORDINALITY AS ord(id, idx)
  WHERE sp.id = ord.id;
END;
$$;

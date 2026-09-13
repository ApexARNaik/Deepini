-- Migration 010: Add location_id to projects and atomic archive function

ALTER TABLE projects 
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES spatial_hotspots(id) ON DELETE SET NULL;

-- Atomic archive RPC function ensuring a project cannot be archived without a valid leaf hotspot location
CREATE OR REPLACE FUNCTION archive_project(
  p_project_id UUID,
  p_location_id UUID
) RETURNS projects AS $$
DECLARE
  v_is_leaf BOOLEAN;
  v_proj projects;
BEGIN
  IF p_location_id IS NULL THEN
    RAISE EXCEPTION 'A valid leaf storage location is required to archive a project.';
  END IF;

  SELECT is_leaf INTO v_is_leaf FROM spatial_hotspots WHERE id = p_location_id;
  IF v_is_leaf IS NULL THEN
    RAISE EXCEPTION 'Location with id % does not exist.', p_location_id;
  END IF;
  IF v_is_leaf = FALSE THEN
    RAISE EXCEPTION 'Project archive location must reference a leaf storage location, not an intermediate view.';
  END IF;

  UPDATE projects
  SET status = 'archived',
      location_id = p_location_id,
      updated_at = now()
  WHERE id = p_project_id
  RETURNING * INTO v_proj;

  RETURN v_proj;
END;
$$ LANGUAGE plpgsql;

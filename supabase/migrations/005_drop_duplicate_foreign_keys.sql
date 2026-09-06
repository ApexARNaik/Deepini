-- Migration 005: Clean up duplicate foreign key constraints
-- Drops redundant 'fk_*' constraints added by 001_safe_schema_and_rpcs.sql
-- that duplicated preexisting PostgreSQL default constraints ('*_fkey').
-- This prevents PostgREST PGRST201 ("Could not embed because more than one relationship was found") errors.

DO $$
BEGIN
    -- 1. component_tags
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_component_tags_component') THEN
        ALTER TABLE component_tags DROP CONSTRAINT fk_component_tags_component;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_component_tags_tag') THEN
        ALTER TABLE component_tags DROP CONSTRAINT fk_component_tags_tag;
    END IF;

    -- 2. component_locations
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_component_locations_component') THEN
        ALTER TABLE component_locations DROP CONSTRAINT fk_component_locations_component;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_component_locations_hotspot') THEN
        ALTER TABLE component_locations DROP CONSTRAINT fk_component_locations_hotspot;
    END IF;

    -- 3. project_components
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_project_components_project') THEN
        ALTER TABLE project_components DROP CONSTRAINT fk_project_components_project;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_project_components_component') THEN
        ALTER TABLE project_components DROP CONSTRAINT fk_project_components_component;
    END IF;

    -- 4. spatial_photos
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_spatial_photos_room') THEN
        ALTER TABLE spatial_photos DROP CONSTRAINT fk_spatial_photos_room;
    END IF;
END $$;

-- Reload PostgREST schema cache to immediately reflect constraint cleanup
NOTIFY pgrst, 'reload schema';

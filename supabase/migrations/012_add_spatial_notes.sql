-- Migration: 012_add_spatial_notes.sql
-- Adds spatial notes / sticky annotations on room views and storage locations,
-- with support for linking to either a storage location or a component (even when moved).

CREATE TABLE IF NOT EXISTS spatial_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID REFERENCES spatial_photos(id) ON DELETE CASCADE,
  hotspot_id UUID REFERENCES spatial_hotspots(id) ON DELETE CASCADE,
  component_id UUID REFERENCES components(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  x NUMERIC NOT NULL DEFAULT 0.5,
  y NUMERIC NOT NULL DEFAULT 0.5,
  color TEXT DEFAULT 'amber',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_spatial_notes_photo_id ON spatial_notes(photo_id);
CREATE INDEX IF NOT EXISTS idx_spatial_notes_component_id ON spatial_notes(component_id);
CREATE INDEX IF NOT EXISTS idx_spatial_notes_hotspot_id ON spatial_notes(hotspot_id);

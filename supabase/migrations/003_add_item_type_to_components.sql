-- Migration: 003_add_item_type_to_components.sql
-- Description: Add item_type column to components table to differentiate between components and personal items

ALTER TABLE components
  ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'component';

-- Migration: 002_create_canvas_script_tables (DOWN)
-- Description: Drop canvas script tables
-- Author: Canvas Integration Project
-- Date: 2026-08-14

BEGIN;

-- Drop trigger
DROP TRIGGER IF EXISTS update_canvas_script_documents_updated_at_trigger ON canvas_script_documents;

-- Drop trigger function
DROP FUNCTION IF EXISTS update_canvas_script_documents_updated_at();

-- Drop tables (CASCADE will remove dependent objects)
DROP TABLE IF EXISTS canvas_script_versions CASCADE;
DROP TABLE IF EXISTS canvas_script_documents CASCADE;

COMMIT;

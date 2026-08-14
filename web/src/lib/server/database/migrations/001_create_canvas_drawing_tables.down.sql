-- Migration: 001_create_canvas_drawing_tables (DOWN)
-- Description: Rollback canvas drawing tables and related objects
-- Author: Canvas Integration Project
-- Date: 2026-08-14

BEGIN;

-- Drop trigger
DROP TRIGGER IF EXISTS update_canvas_drawing_documents_updated_at_trigger
    ON canvas_drawing_documents;

-- Drop trigger function
DROP FUNCTION IF EXISTS update_canvas_drawing_documents_updated_at();

-- Drop tables (CASCADE will drop foreign key constraints)
DROP TABLE IF EXISTS canvas_drawing_versions CASCADE;
DROP TABLE IF EXISTS canvas_drawing_documents CASCADE;

COMMIT;

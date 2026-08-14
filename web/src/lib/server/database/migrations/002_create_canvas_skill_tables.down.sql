-- Migration: 002_create_canvas_skill_tables (DOWN)
-- Description: Drop tables for canvas skill documents and execution history

BEGIN;

-- Drop triggers
DROP TRIGGER IF EXISTS update_canvas_skill_documents_updated_at_trigger ON canvas_skill_documents;

-- Drop trigger functions
DROP FUNCTION IF EXISTS update_canvas_skill_documents_updated_at();

-- Drop tables
DROP TABLE IF EXISTS canvas_skill_execution_history;
DROP TABLE IF EXISTS canvas_skill_documents;

COMMIT;

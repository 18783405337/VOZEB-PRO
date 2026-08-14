-- Migration: 003_create_canvas_director3d_tables (Rollback)
-- Description: Drop tables for 3D director scene data
-- Author: 3D Director Feature
-- Date: 2026-08-14

BEGIN;

-- Drop trigger
DROP TRIGGER IF EXISTS update_canvas_director3d_scenes_updated_at_trigger ON canvas_director3d_scenes;

-- Drop trigger function
DROP FUNCTION IF EXISTS update_canvas_director3d_scenes_updated_at();

-- Drop indexes
DROP INDEX IF EXISTS idx_canvas_director3d_versions_created_at;
DROP INDEX IF EXISTS idx_canvas_director3d_versions_scene_id;
DROP INDEX IF EXISTS idx_canvas_director3d_scenes_updated_at;
DROP INDEX IF EXISTS idx_canvas_director3d_scenes_user_id;
DROP INDEX IF EXISTS idx_canvas_director3d_scenes_project_id;

-- Drop tables
DROP TABLE IF EXISTS canvas_director3d_versions CASCADE;
DROP TABLE IF EXISTS canvas_director3d_scenes CASCADE;

COMMIT;

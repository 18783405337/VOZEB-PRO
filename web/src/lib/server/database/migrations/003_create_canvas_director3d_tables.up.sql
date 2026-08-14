-- Migration: 003_create_canvas_director3d_tables
-- Description: Create tables for 3D director scene data
-- Author: 3D Director Feature
-- Date: 2026-08-14

BEGIN;

-- Create canvas_director3d_scenes table
CREATE TABLE IF NOT EXISTS canvas_director3d_scenes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    user_id UUID NOT NULL,
    scene_id TEXT NOT NULL,
    snapshot JSONB NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    camera_count INTEGER NOT NULL DEFAULT 1,
    light_count INTEGER NOT NULL DEFAULT 2,
    model_count INTEGER NOT NULL DEFAULT 0,
    preview_url TEXT,
    preview_storage_key TEXT,
    thumbnail_url TEXT,
    thumbnail_storage_key TEXT,
    render_metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, scene_id)
);

-- Create indexes for canvas_director3d_scenes
CREATE INDEX idx_canvas_director3d_scenes_project_id
    ON canvas_director3d_scenes(project_id);

CREATE INDEX idx_canvas_director3d_scenes_user_id
    ON canvas_director3d_scenes(user_id);

CREATE INDEX idx_canvas_director3d_scenes_updated_at
    ON canvas_director3d_scenes(updated_at DESC);

-- Create canvas_director3d_versions table
CREATE TABLE IF NOT EXISTS canvas_director3d_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scene_id UUID NOT NULL REFERENCES canvas_director3d_scenes(id) ON DELETE CASCADE,
    revision INTEGER NOT NULL,
    snapshot JSONB NOT NULL,
    description TEXT,
    camera_count INTEGER NOT NULL DEFAULT 1,
    light_count INTEGER NOT NULL DEFAULT 2,
    model_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(scene_id, revision)
);

-- Create indexes for canvas_director3d_versions
CREATE INDEX idx_canvas_director3d_versions_scene_id
    ON canvas_director3d_versions(scene_id);

CREATE INDEX idx_canvas_director3d_versions_created_at
    ON canvas_director3d_versions(created_at DESC);

-- Create trigger function for updating updated_at
CREATE OR REPLACE FUNCTION update_canvas_director3d_scenes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_canvas_director3d_scenes_updated_at_trigger
    BEFORE UPDATE ON canvas_director3d_scenes
    FOR EACH ROW
    EXECUTE FUNCTION update_canvas_director3d_scenes_updated_at();

COMMIT;

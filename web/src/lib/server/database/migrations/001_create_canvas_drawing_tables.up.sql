-- Migration: 001_create_canvas_drawing_tables
-- Description: Create tables for canvas drawing documents and version history
-- Author: Canvas Integration Project
-- Date: 2026-08-14

BEGIN;

-- Create canvas_drawing_documents table
CREATE TABLE IF NOT EXISTS canvas_drawing_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    user_id UUID NOT NULL,
    drawing_id TEXT NOT NULL,
    engine TEXT NOT NULL CHECK (engine IN ('excalidraw', 'tldraw')),
    snapshot JSONB NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    shape_count INTEGER NOT NULL DEFAULT 0,
    page_count INTEGER NOT NULL DEFAULT 1,
    preview_url TEXT,
    preview_storage_key TEXT,
    render_url TEXT,
    render_storage_key TEXT,
    render_metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, drawing_id)
);

-- Create indexes for canvas_drawing_documents
CREATE INDEX idx_canvas_drawing_documents_project_id
    ON canvas_drawing_documents(project_id);

CREATE INDEX idx_canvas_drawing_documents_user_id
    ON canvas_drawing_documents(user_id);

CREATE INDEX idx_canvas_drawing_documents_updated_at
    ON canvas_drawing_documents(updated_at DESC);

-- Create canvas_drawing_versions table
CREATE TABLE IF NOT EXISTS canvas_drawing_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES canvas_drawing_documents(id) ON DELETE CASCADE,
    revision INTEGER NOT NULL,
    snapshot JSONB NOT NULL,
    description TEXT,
    shape_count INTEGER NOT NULL DEFAULT 0,
    page_count INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(document_id, revision)
);

-- Create indexes for canvas_drawing_versions
CREATE INDEX idx_canvas_drawing_versions_document_id
    ON canvas_drawing_versions(document_id);

CREATE INDEX idx_canvas_drawing_versions_created_at
    ON canvas_drawing_versions(created_at DESC);

-- Create trigger function for updating updated_at
CREATE OR REPLACE FUNCTION update_canvas_drawing_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_canvas_drawing_documents_updated_at_trigger
    BEFORE UPDATE ON canvas_drawing_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_canvas_drawing_documents_updated_at();

COMMIT;

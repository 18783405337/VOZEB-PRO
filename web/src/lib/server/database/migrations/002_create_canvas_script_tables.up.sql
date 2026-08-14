-- Migration: 002_create_canvas_script_tables
-- Description: Create tables for canvas script documents and version history
-- Author: Canvas Integration Project
-- Date: 2026-08-14

BEGIN;

-- Create canvas_script_documents table
CREATE TABLE IF NOT EXISTS canvas_script_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    user_id UUID NOT NULL,
    script_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT 'Untitled Script',
    content JSONB NOT NULL,
    markdown TEXT,
    plain_text TEXT NOT NULL DEFAULT '',
    character_count INTEGER NOT NULL DEFAULT 0,
    word_count INTEGER NOT NULL DEFAULT 0,
    revision INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, script_id)
);

-- Create indexes for canvas_script_documents
CREATE INDEX idx_canvas_script_documents_project_id
    ON canvas_script_documents(project_id);

CREATE INDEX idx_canvas_script_documents_user_id
    ON canvas_script_documents(user_id);

CREATE INDEX idx_canvas_script_documents_updated_at
    ON canvas_script_documents(updated_at DESC);

CREATE INDEX idx_canvas_script_documents_plain_text
    ON canvas_script_documents USING gin(to_tsvector('english', plain_text));

-- Create canvas_script_versions table
CREATE TABLE IF NOT EXISTS canvas_script_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES canvas_script_documents(id) ON DELETE CASCADE,
    revision INTEGER NOT NULL,
    content JSONB NOT NULL,
    markdown TEXT,
    description TEXT,
    character_count INTEGER NOT NULL DEFAULT 0,
    word_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(document_id, revision)
);

-- Create indexes for canvas_script_versions
CREATE INDEX idx_canvas_script_versions_document_id
    ON canvas_script_versions(document_id);

CREATE INDEX idx_canvas_script_versions_created_at
    ON canvas_script_versions(created_at DESC);

-- Create trigger function for updating updated_at
CREATE OR REPLACE FUNCTION update_canvas_script_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_canvas_script_documents_updated_at_trigger
    BEFORE UPDATE ON canvas_script_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_canvas_script_documents_updated_at();

COMMIT;

-- Migration: 002_create_canvas_skill_tables
-- Description: Create tables for canvas skill documents and execution history
-- Author: Canvas Integration Project
-- Date: 2026-08-14

BEGIN;

-- Create canvas_skill_documents table
CREATE TABLE IF NOT EXISTS canvas_skill_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    user_id UUID NOT NULL,
    skill_id TEXT NOT NULL,
    template_id TEXT NOT NULL,
    name TEXT NOT NULL,
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'success', 'error')),
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    output JSONB,
    error TEXT,
    last_executed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, skill_id)
);

-- Create indexes for canvas_skill_documents
CREATE INDEX idx_canvas_skill_documents_project_id
    ON canvas_skill_documents(project_id);

CREATE INDEX idx_canvas_skill_documents_user_id
    ON canvas_skill_documents(user_id);

CREATE INDEX idx_canvas_skill_documents_template_id
    ON canvas_skill_documents(template_id);

CREATE INDEX idx_canvas_skill_documents_status
    ON canvas_skill_documents(status);

CREATE INDEX idx_canvas_skill_documents_updated_at
    ON canvas_skill_documents(updated_at DESC);

-- Create canvas_skill_execution_history table
CREATE TABLE IF NOT EXISTS canvas_skill_execution_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_document_id UUID NOT NULL REFERENCES canvas_skill_documents(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('success', 'error')),
    parameters JSONB NOT NULL,
    output JSONB,
    error TEXT,
    execution_time_ms INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for canvas_skill_execution_history
CREATE INDEX idx_canvas_skill_execution_history_document_id
    ON canvas_skill_execution_history(skill_document_id);

CREATE INDEX idx_canvas_skill_execution_history_created_at
    ON canvas_skill_execution_history(created_at DESC);

CREATE INDEX idx_canvas_skill_execution_history_status
    ON canvas_skill_execution_history(status);

-- Create trigger function for updating updated_at
CREATE OR REPLACE FUNCTION update_canvas_skill_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_canvas_skill_documents_updated_at_trigger
    BEFORE UPDATE ON canvas_skill_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_canvas_skill_documents_updated_at();

COMMIT;

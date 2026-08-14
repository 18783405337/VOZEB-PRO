-- Migration: Add Storyboard tables
-- Description: Create tables for Canvas Storyboard feature
-- Date: 2026-08-14

-- Canvas Storyboard 主表
CREATE TABLE IF NOT EXISTS canvas_storyboard (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    storyboard_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    revision INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, storyboard_id)
);

-- Canvas Storyboard 场景表
CREATE TABLE IF NOT EXISTS canvas_storyboard_scene (
    id TEXT PRIMARY KEY,
    storyboard_id TEXT NOT NULL,
    scene_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    time_of_day TEXT,
    weather TEXT,
    mood TEXT,
    color TEXT,
    collapsed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (storyboard_id) REFERENCES canvas_storyboard(storyboard_id) ON DELETE CASCADE
);

-- Canvas Storyboard 镜头表
CREATE TABLE IF NOT EXISTS canvas_storyboard_shot (
    id TEXT PRIMARY KEY,
    storyboard_id TEXT NOT NULL,
    scene_id TEXT NOT NULL,
    shot_number INTEGER NOT NULL,
    global_order INTEGER NOT NULL,
    title TEXT,
    description TEXT NOT NULL,
    visual_description TEXT,
    shot_type TEXT NOT NULL,
    camera_angle TEXT NOT NULL,
    camera_movement TEXT NOT NULL,
    duration REAL NOT NULL DEFAULT 3.0,
    transition TEXT NOT NULL DEFAULT 'cut',
    transition_duration REAL,
    dialogue TEXT,
    action TEXT,
    sound TEXT,
    music TEXT,
    image_url TEXT,
    image_storage_key TEXT,
    image_task_id TEXT,
    video_url TEXT,
    video_storage_key TEXT,
    video_task_id TEXT,
    reference_image_ids TEXT, -- JSON array
    prompt TEXT,
    generation_model TEXT,
    generation_params TEXT, -- JSON object
    status TEXT NOT NULL DEFAULT 'draft',
    priority TEXT NOT NULL DEFAULT 'normal',
    tags TEXT, -- JSON array
    notes TEXT,
    character_ids TEXT, -- JSON array
    location_id TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (storyboard_id) REFERENCES canvas_storyboard(storyboard_id) ON DELETE CASCADE,
    FOREIGN KEY (scene_id) REFERENCES canvas_storyboard_scene(id) ON DELETE CASCADE
);

-- Canvas Storyboard 批量生成任务表
CREATE TABLE IF NOT EXISTS canvas_storyboard_batch_task (
    id TEXT PRIMARY KEY,
    storyboard_id TEXT NOT NULL,
    generation_type TEXT NOT NULL, -- 'image' or 'video'
    model TEXT,
    shot_ids TEXT NOT NULL, -- JSON array
    config TEXT NOT NULL, -- JSON object
    status TEXT NOT NULL DEFAULT 'pending',
    progress_total INTEGER NOT NULL DEFAULT 0,
    progress_completed INTEGER NOT NULL DEFAULT 0,
    progress_failed INTEGER NOT NULL DEFAULT 0,
    progress_current TEXT,
    results TEXT, -- JSON array
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (storyboard_id) REFERENCES canvas_storyboard(storyboard_id) ON DELETE CASCADE
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_canvas_storyboard_project_id ON canvas_storyboard(project_id);
CREATE INDEX IF NOT EXISTS idx_canvas_storyboard_storyboard_id ON canvas_storyboard(storyboard_id);
CREATE INDEX IF NOT EXISTS idx_canvas_storyboard_scene_storyboard_id ON canvas_storyboard_scene(storyboard_id);
CREATE INDEX IF NOT EXISTS idx_canvas_storyboard_scene_scene_number ON canvas_storyboard_scene(scene_number);
CREATE INDEX IF NOT EXISTS idx_canvas_storyboard_shot_storyboard_id ON canvas_storyboard_shot(storyboard_id);
CREATE INDEX IF NOT EXISTS idx_canvas_storyboard_shot_scene_id ON canvas_storyboard_shot(scene_id);
CREATE INDEX IF NOT EXISTS idx_canvas_storyboard_shot_global_order ON canvas_storyboard_shot(global_order);
CREATE INDEX IF NOT EXISTS idx_canvas_storyboard_shot_status ON canvas_storyboard_shot(status);
CREATE INDEX IF NOT EXISTS idx_canvas_storyboard_batch_task_storyboard_id ON canvas_storyboard_batch_task(storyboard_id);
CREATE INDEX IF NOT EXISTS idx_canvas_storyboard_batch_task_status ON canvas_storyboard_batch_task(status);

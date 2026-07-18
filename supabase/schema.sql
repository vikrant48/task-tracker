-- Supabase Database Schema Migration Script
-- Creates tables for tracking tasks and daily completion entries, enables RLS, and sets policies.

-- 1. CLEANUP (Optional / Re-runnable setup)
DROP TABLE IF EXISTS entries CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;

-- 2. CREATE TASKS TABLE
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security (RLS) on tasks
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- 3. CREATE ENTRIES TABLE
CREATE TABLE entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    entry_date DATE NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (task_id, entry_date)
);

-- Enable Row Level Security (RLS) on entries
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;

-- 4. RLS POLICIES

-- Tasks policies
CREATE POLICY "Users can fully manage their own tasks" ON tasks
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Entries policies
CREATE POLICY "Users can fully manage their own task entries" ON entries
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 5. PERFORMANCE INDEXES
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_entries_task_id ON entries(task_id);
CREATE INDEX idx_entries_user_date ON entries(user_id, entry_date);
CREATE INDEX idx_tasks_sort_order ON tasks(sort_order);

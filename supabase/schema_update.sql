-- FocusFlow Schema Update Script
-- Adds category tagging support to tasks.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'General';

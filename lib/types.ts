import type { Database } from '@/lib/database.types';

type Tables = Database['public']['Tables'];

export type Task = Tables['tasks']['Row'];
export type TaskShare = Tables['task_shares']['Row'];
export type DailyTask = Tables['daily_tasks']['Row'];

// A completion cell as the UI tracks it (rows from the DB have more columns; only these are needed)
export interface Entry {
    id?: string;
    task_id: string;
    entry_date: string;
    completed: boolean;
    // Your note for that day (max 500 chars)
    note?: string | null;
}

// Another member's completed day on a habit shared with you (read-only)
export interface PartnerCheckIn {
    task_id: string;
    user_id: string;
    entry_date: string;
}

// A check-in made while offline, waiting to be synced
export interface QueuedEntry {
    task_id: string;
    entry_date: string;
    completed: boolean;
    timestamp: string;
}

export interface NewHabit {
    name: string;
    category: string;
    // Weekdays due (see lib/schedule.ts); every day when omitted
    schedule_mask?: number;
}

export type SyncState = 'synced' | 'syncing' | 'offline';
export type MobileViewMode = 'cards' | 'matrix';

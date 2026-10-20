import type { Entry, QueuedEntry } from '@/lib/types';

// Entries are unique per person per habit per day (see supabase/schema.sql)
export const ENTRY_CONFLICT_COLUMNS = 'task_id,user_id,entry_date';

// Set the completed flag for one task/date cell, inserting the entry if missing. Never mutates `list`.
export function applyEntryChange(list: Entry[], taskId: string, dateStr: string, completed: boolean): Entry[] {
    const matchIndex = list.findIndex((e) => e.task_id === taskId && e.entry_date === dateStr);
    if (matchIndex === -1) {
        return [...list, { task_id: taskId, entry_date: dateStr, completed }];
    }
    const updated = [...list];
    updated[matchIndex] = { ...updated[matchIndex], completed };
    return updated;
}

// Set the note for one task/date cell, inserting an unticked entry if missing. Never mutates `list`.
export function applyNoteChange(list: Entry[], taskId: string, dateStr: string, note: string | null): Entry[] {
    const matchIndex = list.findIndex((e) => e.task_id === taskId && e.entry_date === dateStr);
    if (matchIndex === -1) {
        return [...list, { task_id: taskId, entry_date: dateStr, completed: false, note }];
    }
    const updated = [...list];
    updated[matchIndex] = { ...updated[matchIndex], note };
    return updated;
}

// Overlay unsynced offline check-ins on top of data loaded from the server
export function applyOfflineQueue(list: Entry[], queue: QueuedEntry[]): Entry[] {
    return queue.reduce((acc, q) => applyEntryChange(acc, q.task_id, q.entry_date, q.completed), list);
}

type Sortable = { sort_order: number; created_at: string };

export function nextSortOrder(tasks: Sortable[]): number {
    return tasks.length > 0 ? Math.max(...tasks.map((t) => t.sort_order)) + 1 : 0;
}

export function sortByOrder<T extends Sortable>(tasks: T[]): T[] {
    return [...tasks].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
}

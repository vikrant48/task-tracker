import type { Entry, PartnerCheckIn } from '@/lib/types';

// A change to an `entries` row pushed by Supabase Realtime (the old row is complete thanks to REPLICA IDENTITY FULL)
export interface EntryChange {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    new: Partial<EntryRow>;
    old: Partial<EntryRow>;
}

export interface EntryRow {
    task_id: string;
    user_id: string;
    entry_date: string;
    completed: boolean;
    note: string | null;
}

// The row a change is about, and whether it still exists
export function changedRow(change: EntryChange): { row: EntryRow; deleted: boolean } | null {
    const deleted = change.eventType === 'DELETE';
    const row = (deleted ? change.old : change.new) as EntryRow;
    if (!row?.task_id || !row.user_id || !row.entry_date) return null;
    return { row, deleted };
}

// Your own entry changed elsewhere (another device): replace or remove it. Never mutates `list`.
export function mergeOwnEntry(list: Entry[], row: EntryRow, deleted: boolean): Entry[] {
    const rest = list.filter((e) => !(e.task_id === row.task_id && e.entry_date === row.entry_date));
    if (deleted) return rest;
    return [...rest, { task_id: row.task_id, entry_date: row.entry_date, completed: row.completed, note: row.note ?? null }];
}

// A partner's check-in on a shared habit: keep only completed days. Never mutates `list`.
export function mergePartnerCheckIn(list: PartnerCheckIn[], row: EntryRow, deleted: boolean): PartnerCheckIn[] {
    const rest = list.filter((p) => !(p.task_id === row.task_id && p.user_id === row.user_id && p.entry_date === row.entry_date));
    if (deleted || !row.completed) return rest;
    return [...rest, { task_id: row.task_id, user_id: row.user_id, entry_date: row.entry_date }];
}

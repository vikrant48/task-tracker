import { z } from 'zod';
import type { BrowserSupabaseClient } from '@/lib/supabase/client';
import { ENTRY_CONFLICT_COLUMNS } from '@/lib/entries';
import { EVERY_DAY } from '@/lib/schedule';

// A full backup of your own data as JSON: your habits (not ones shared with you), your check-ins and notes on them,
// and your daily tasks. Restoring merges: items already in your account (same id) are updated, never duplicated.

const PAGE = 1000;
const CHUNK = 500;

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timestamp = z.string().max(40);

const backupSchema = z.object({
    app: z.literal('focusflow'),
    version: z.literal(1),
    exported_at: timestamp,
    tasks: z
        .array(
            z.object({
                id: z.uuid(),
                name: z.string().trim().min(1).max(200),
                category: z.string().max(40).default('General'),
                sort_order: z.number().int().default(0),
                archived: z.boolean().default(false),
                schedule_mask: z.number().int().min(1).max(127).default(EVERY_DAY),
                created_at: timestamp.optional(),
            })
        )
        .max(1000),
    entries: z
        .array(
            z.object({
                task_id: z.uuid(),
                entry_date: dateStr,
                completed: z.boolean(),
                completed_at: timestamp.nullable().optional(),
                note: z.string().max(500).nullable().optional(),
            })
        )
        .max(200_000),
    daily_tasks: z
        .array(
            z.object({
                id: z.uuid(),
                title: z.string().trim().min(1).max(200),
                task_date: dateStr,
                completed: z.boolean(),
                completed_at: timestamp.nullable().optional(),
                moved_from: dateStr.nullable().optional(),
                habit_id: z.uuid().nullable().optional(),
                created_at: timestamp.optional(),
            })
        )
        .max(50_000),
});

export type Backup = z.infer<typeof backupSchema>;

export interface RestoreSummary {
    habits: number;
    checkIns: number;
    dailyTasks: number;
}

// Read every page of a query (PostgREST caps responses at 1000 rows)
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
    const rows: T[] = [];
    for (let from = 0; ; from += PAGE) {
        const { data, error } = await page(from, from + PAGE - 1);
        if (error) throw error;
        rows.push(...(data ?? []));
        if (!data || data.length < PAGE) return rows;
    }
}

const chunks = <T>(list: T[]) => Array.from({ length: Math.ceil(list.length / CHUNK) }, (_, i) => list.slice(i * CHUNK, (i + 1) * CHUNK));

export async function exportBackup(supabase: BrowserSupabaseClient, userId: string): Promise<Backup> {
    const tasks = await fetchAll((from, to) =>
        supabase.from('tasks').select('id, name, category, sort_order, archived, schedule_mask, created_at').eq('user_id', userId).order('created_at').range(from, to)
    );
    const ownTaskIds = new Set(tasks.map((t) => t.id));
    const entries = await fetchAll((from, to) =>
        supabase.from('entries').select('task_id, entry_date, completed, completed_at, note').eq('user_id', userId).order('entry_date').range(from, to)
    );
    const dailyTasks = await fetchAll((from, to) =>
        supabase.from('daily_tasks').select('id, title, task_date, completed, completed_at, moved_from, habit_id, created_at').eq('user_id', userId).order('task_date').range(from, to)
    );

    return {
        app: 'focusflow',
        version: 1,
        exported_at: new Date().toISOString(),
        tasks: tasks.map((t) => ({ ...t, category: t.category ?? 'General' })),
        // Check-ins on habits shared with you belong with the owner's habit, so they're left out
        entries: entries.filter((e) => ownTaskIds.has(e.task_id)),
        daily_tasks: dailyTasks,
    };
}

// Validate a backup file's contents. Throws an Error with a readable message.
export function parseBackup(text: string): Backup {
    let json: unknown;
    try {
        json = JSON.parse(text);
    } catch {
        throw new Error('This file is not a FocusFlow backup (it is not valid JSON).');
    }
    const result = backupSchema.safeParse(json);
    if (!result.success) {
        throw new Error('This file is not a valid FocusFlow backup.');
    }
    return result.data;
}

// Ids from the backup that already belong to you keep their id (so a restore updates them in place);
// anything else gets a fresh id, so a backup from another account can't touch rows you don't own.
async function ownedIds(supabase: BrowserSupabaseClient, table: 'tasks' | 'daily_tasks', userId: string, ids: string[]) {
    const owned = new Set<string>();
    for (const part of chunks(ids)) {
        const { data, error } = await supabase.from(table).select('id').eq('user_id', userId).in('id', part);
        if (error) throw error;
        data?.forEach((r) => owned.add(r.id));
    }
    return owned;
}

export async function restoreBackup(supabase: BrowserSupabaseClient, userId: string, backup: Backup): Promise<RestoreSummary> {
    const ownedTasks = await ownedIds(supabase, 'tasks', userId, backup.tasks.map((t) => t.id));
    const taskIdMap = new Map(backup.tasks.map((t) => [t.id, ownedTasks.has(t.id) ? t.id : crypto.randomUUID()]));

    for (const part of chunks(backup.tasks)) {
        const { error } = await supabase.from('tasks').upsert(part.map((t) => ({ ...t, id: taskIdMap.get(t.id)!, user_id: userId })));
        if (error) throw error;
    }

    const entries = backup.entries
        .filter((e) => taskIdMap.has(e.task_id))
        .map((e) => ({ ...e, task_id: taskIdMap.get(e.task_id)!, user_id: userId }));
    for (const part of chunks(entries)) {
        const { error } = await supabase.from('entries').upsert(part, { onConflict: ENTRY_CONFLICT_COLUMNS });
        if (error) throw error;
    }

    const ownedDaily = await ownedIds(supabase, 'daily_tasks', userId, backup.daily_tasks.map((t) => t.id));
    const dailyTasks = backup.daily_tasks.map((t) => ({
        ...t,
        id: ownedDaily.has(t.id) ? t.id : crypto.randomUUID(),
        // Keep the habit link only to a habit restored above
        habit_id: t.habit_id ? (taskIdMap.get(t.habit_id) ?? null) : null,
        user_id: userId,
    }));
    for (const part of chunks(dailyTasks)) {
        const { error } = await supabase.from('daily_tasks').upsert(part);
        if (error) throw error;
    }

    return { habits: backup.tasks.length, checkIns: entries.length, dailyTasks: dailyTasks.length };
}

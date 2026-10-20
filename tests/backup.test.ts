import { describe, it, expect } from 'vitest';
import { createFakeSupabase } from './helpers/fakeSupabase';
import { exportBackup, parseBackup, restoreBackup } from '@/lib/backup';
import type { BrowserSupabaseClient } from '@/lib/supabase/client';

const ME = 'user-1';
const HABIT = 'aaaaaaaa-0000-4000-8000-000000000001';
const PARTNER_HABIT = 'bbbbbbbb-0000-4000-8000-000000000002';
const DAILY = 'cccccccc-0000-4000-8000-000000000003';

function seed() {
    return {
        tasks: [
            { id: HABIT, user_id: ME, name: 'Read', category: 'Personal', sort_order: 0, archived: false, schedule_mask: 62, created_at: '2026-09-01T08:00:00.000Z' },
            { id: PARTNER_HABIT, user_id: 'user-2', name: 'Yoga', category: 'Health', sort_order: 0, archived: false, schedule_mask: 127, created_at: '2026-09-01T08:00:00.000Z' },
        ],
        entries: [
            { id: 'e1', task_id: HABIT, user_id: ME, entry_date: '2026-10-13', completed: true, completed_at: null, note: 'chapter 3' },
            { id: 'e2', task_id: PARTNER_HABIT, user_id: ME, entry_date: '2026-10-13', completed: true, completed_at: null, note: null },
        ],
        daily_tasks: [
            { id: DAILY, user_id: ME, title: 'Call bank', task_date: '2026-10-14', completed: false, completed_at: null, moved_from: null, created_at: '2026-10-14T08:00:00.000Z' },
        ],
    };
}

const client = (db: Record<string, Record<string, unknown>[]>) =>
    createFakeSupabase(db, { user: { id: ME, email: 'me@example.com' } }).client as unknown as BrowserSupabaseClient;

describe('backup export / restore', () => {
    it('exports your habits, their check-ins with notes, and your daily tasks', async () => {
        const backup = await exportBackup(client(seed()), ME);
        expect(backup.tasks.map((t) => t.name)).toEqual(['Read']);
        // Check-ins on a partner's habit stay with that habit
        expect(backup.entries).toEqual([expect.objectContaining({ task_id: HABIT, note: 'chapter 3' })]);
        expect(backup.daily_tasks).toHaveLength(1);
        expect(parseBackup(JSON.stringify(backup))).toMatchObject({ app: 'focusflow', tasks: [{ id: HABIT, schedule_mask: 62 }], daily_tasks: [{ title: 'Call bank' }] });
    });

    it('restoring into the same account updates in place without duplicates', async () => {
        const db = seed();
        const supabase = client(db);
        const backup = await exportBackup(supabase, ME);
        db.entries[0].note = 'changed later';

        const summary = await restoreBackup(supabase, ME, backup);

        expect(summary).toEqual({ habits: 1, checkIns: 1, dailyTasks: 1 });
        expect(db.tasks).toHaveLength(2);
        expect(db.entries).toHaveLength(2);
        expect(db.daily_tasks).toHaveLength(1);
        expect(db.entries[0].note).toBe('chapter 3');
    });

    it("gives fresh ids to items you don't own, keeping check-ins linked", async () => {
        const backup = await exportBackup(client(seed()), ME);
        const empty = { tasks: [], entries: [], daily_tasks: [] } as Record<string, Record<string, unknown>[]>;

        await restoreBackup(client(empty), ME, backup);

        expect(empty.tasks).toHaveLength(1);
        expect(empty.tasks[0].id).not.toBe(HABIT);
        expect(empty.tasks[0]).toMatchObject({ name: 'Read', user_id: ME, schedule_mask: 62 });
        expect(empty.entries[0]).toMatchObject({ task_id: empty.tasks[0].id, user_id: ME, note: 'chapter 3' });
        expect(empty.daily_tasks[0]).toMatchObject({ title: 'Call bank', user_id: ME });
        expect(empty.daily_tasks[0].id).not.toBe(DAILY);
    });

    it('rejects files that are not FocusFlow backups', () => {
        expect(() => parseBackup('not json')).toThrow(/not valid JSON/);
        expect(() => parseBackup('{"app":"other"}')).toThrow(/not a valid FocusFlow backup/);
        expect(() => parseBackup(JSON.stringify({ app: 'focusflow', version: 1, exported_at: 'x', tasks: [{ id: 'nope', name: 'x' }], entries: [], daily_tasks: [] }))).toThrow();
    });
});

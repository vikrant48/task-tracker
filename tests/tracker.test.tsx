// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { createFakeSupabase, type FakeSupabaseOptions } from './helpers/fakeSupabase';

// Characterization tests for the Weekly Tracker: they pin down user-visible behaviour so the
// component can be refactored safely.

const holder = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => holder.client }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import WeeklyTracker from '@/components/tracker/WeeklyTracker';

const USER = { id: 'user-1', email: 'me@example.com' };
const TODAY = '2026-10-14'; // a Wednesday; week is Mon 12 – Sun 18

const TASK_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const TASK_B = 'bbbbbbbb-0000-4000-8000-000000000002';
const TASK_C = 'cccccccc-0000-4000-8000-000000000003';

function seedDb() {
    const base = { user_id: USER.id, archived: false, schedule_mask: 127, created_at: '2026-09-01T08:00:00.000Z' };
    return {
        tasks: [
            { ...base, id: TASK_A, name: 'Read 10 pages', category: 'Personal', sort_order: 0 },
            { ...base, id: TASK_B, name: 'Drink water', category: 'Health', sort_order: 1 },
            { ...base, id: TASK_C, name: 'Deep work', category: 'Work', sort_order: 2 },
        ],
        entries: ['2026-10-12', '2026-10-13', '2026-10-14'].map((d, i) => ({
            id: `e${i}`, task_id: TASK_A, user_id: USER.id, entry_date: d, completed: true,
        })),
        task_shares: [] as Record<string, unknown>[],
    };
}

let online = true;
let fake: ReturnType<typeof createFakeSupabase>;
let reorderCalls: string[][] = [];

function setup(db: Record<string, Record<string, unknown>[]> = seedDb(), failOn?: FakeSupabaseOptions['failOn']) {
    reorderCalls = [];
    fake = createFakeSupabase(db, {
        user: USER,
        failOn,
        rpc: {
            get_streak_carry_in: () => ({ data: [], error: null }),
            share_task: () => ({ data: 'ok', error: null }),
            reorder_tasks: (args) => {
                reorderCalls.push(args.p_task_ids as string[]);
                return { data: null, error: null };
            },
        },
    });
    holder.client = fake.client;
    return render(<WeeklyTracker userId={USER.id} />);
}

const cell = (name: string, date: string) => screen.getAllByRole('button', { name: `${name}, ${date}` });
const upserts = () => fake.calls.filter((c) => c.table === 'entries' && c.op === 'upsert');

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 14, 12, 0, 0));
    online = true;
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => online });
    localStorage.clear();
});

afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

describe('Weekly Tracker', () => {
    it('loads the habits for the current week and shows streaks', async () => {
        setup();
        expect((await screen.findAllByText('Read 10 pages')).length).toBeGreaterThan(0);
        expect(screen.getByText('Oct 12 – Oct 18')).toBeTruthy();
        // 3 consecutive days ending today
        expect(screen.getAllByText('3d').length).toBeGreaterThan(0);
        cell('Read 10 pages', TODAY).forEach((b) => expect(b.getAttribute('aria-pressed')).toBe('true'));
    });

    it('saves a toggle with an upsert and keeps the cell checked', async () => {
        setup();
        await screen.findAllByText('Drink water');

        fireEvent.click(cell('Drink water', TODAY)[0]);

        await waitFor(() => expect(upserts()).toHaveLength(1));
        expect(upserts()[0].payload).toMatchObject({
            task_id: TASK_B, user_id: USER.id, entry_date: TODAY, completed: true,
        });
        await waitFor(() => cell('Drink water', TODAY).forEach((b) => expect(b.getAttribute('aria-pressed')).toBe('true')));
    });

    it('rolls back and shows an error when the save fails', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        setup(seedDb(), (c) => (c.op === 'upsert' ? { message: 'network down' } : null));
        await screen.findAllByText('Drink water');

        fireEvent.click(cell('Drink water', TODAY)[0]);

        expect(await screen.findByText(/Your change was not saved/)).toBeTruthy();
        // The optimistic check is dropped once the failed transition settles
        await waitFor(() => cell('Drink water', TODAY).forEach((b) => expect(b.getAttribute('aria-pressed')).toBe('false')));
        expect(fake.db.entries.some((e) => e.task_id === TASK_B)).toBe(false);
        expect(consoleError).toHaveBeenCalledWith('Error toggling entry:', { message: 'network down' });
    });

    it('shows days off as rest days and saves a new schedule', async () => {
        const db = seedDb();
        db.tasks[2].schedule_mask = 0b1000001; // "Deep work" on weekends only
        setup(db);
        await screen.findAllByText('Deep work');

        // Wednesday is a day off: not tickable; Saturday is due
        screen.getAllByRole('button', { name: `Deep work, ${TODAY}, rest day` }).forEach((b) => expect((b as HTMLButtonElement).disabled).toBe(true));
        expect(cell('Deep work', '2026-10-17').length).toBeGreaterThan(0);

        fireEvent.click(screen.getByRole('button', { name: 'Schedule for Drink water' }));
        fireEvent.click(screen.getByRole('button', { name: 'Weekdays' }));
        fireEvent.click(screen.getByRole('button', { name: 'Save schedule' }));

        await waitFor(() => expect(fake.db.tasks.find((t) => t.id === TASK_B)?.schedule_mask).toBe(0b0111110));
        expect(screen.getAllByRole('button', { name: 'Drink water, 2026-10-18, rest day' }).length).toBeGreaterThan(0);
    });

    it('saves a note for a day and shows it on the card', async () => {
        setup();
        await screen.findAllByText('Drink water');

        fireEvent.click(screen.getByRole('button', { name: 'Add note for Drink water' }));
        fireEvent.change(screen.getByRole('textbox', { name: 'Note' }), { target: { value: '  2 litres  ' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save note' }));

        expect(await screen.findByText('2 litres')).toBeTruthy();
        // Only the note is sent, so the day stays unticked
        expect(upserts().at(-1)?.payload).toEqual({ task_id: TASK_B, user_id: USER.id, entry_date: TODAY, note: '2 litres' });
        cell('Drink water', TODAY).forEach((b) => expect(b.getAttribute('aria-pressed')).toBe('false'));
        expect(screen.getByRole('button', { name: 'Edit note for Drink water' })).toBeTruthy();
    });

    it('lets you switch between the day cards and the week grid', async () => {
        setup();
        await screen.findAllByText('Drink water');
        expect(screen.getByRole('button', { name: 'Daily cards' }).getAttribute('aria-pressed')).toBe('true');

        fireEvent.click(screen.getByRole('button', { name: 'Full week grid' }));
        expect(screen.queryByRole('button', { name: 'Add note for Drink water' })).toBeNull();
        expect(cell('Drink water', '2026-10-12')).toHaveLength(1);

        fireEvent.click(screen.getByRole('button', { name: 'Daily cards' }));
        expect(screen.getByRole('button', { name: 'Add note for Drink water' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Schedule for Drink water' })).toBeNull();
    });

    it('does not allow checking future days', async () => {
        setup();
        await screen.findAllByText('Drink water');
        cell('Drink water', '2026-10-15').forEach((b) => expect((b as HTMLButtonElement).disabled).toBe(true));
    });

    it('queues toggles while offline and syncs them when back online', async () => {
        setup();
        await screen.findAllByText('Drink water');

        online = false;
        act(() => { window.dispatchEvent(new Event('offline')); });
        fireEvent.click(cell('Drink water', TODAY)[0]);

        const queue = JSON.parse(localStorage.getItem(`focusflow_offline_queue_${USER.id}`) || '[]');
        expect(queue).toEqual([expect.objectContaining({ task_id: TASK_B, entry_date: TODAY, completed: true })]);
        expect(upserts()).toHaveLength(0);
        cell('Drink water', TODAY).forEach((b) => expect(b.getAttribute('aria-pressed')).toBe('true'));

        online = true;
        act(() => { window.dispatchEvent(new Event('online')); });

        await waitFor(() => expect(upserts()).toHaveLength(1));
        expect(upserts()[0].payload).toEqual([expect.objectContaining({ task_id: TASK_B, entry_date: TODAY, completed: true })]);
        await waitFor(() => expect(localStorage.getItem(`focusflow_offline_queue_${USER.id}`)).toBeNull());
    });

    it('syncs offline edits saved by a previous session on load', async () => {
        localStorage.setItem(`focusflow_offline_queue_${USER.id}`, JSON.stringify([
            { task_id: TASK_B, entry_date: '2026-10-13', completed: true, timestamp: '2026-10-13T10:00:00.000Z' },
        ]));
        setup();

        await waitFor(() => expect(upserts()).toHaveLength(1));
        await waitFor(() => cell('Drink water', '2026-10-13').forEach((b) => expect(b.getAttribute('aria-pressed')).toBe('true')));
        await waitFor(() => expect(localStorage.getItem(`focusflow_offline_queue_${USER.id}`)).toBeNull());
    });

    it('asks for confirmation before deleting, then deletes the habit and its history', async () => {
        setup();
        await screen.findAllByText('Read 10 pages');

        fireEvent.click(screen.getAllByTitle('Archive or delete habit')[0]);
        expect(screen.getByRole('alertdialog')).toBeTruthy();
        expect(fake.calls.some((c) => c.op === 'delete')).toBe(false);

        fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));

        await waitFor(() => expect(fake.calls.some((c) => c.table === 'tasks' && c.op === 'delete')).toBe(true));
        await waitFor(() => expect(screen.queryAllByText('Read 10 pages')).toHaveLength(0));
        expect(fake.db.entries.filter((e) => e.task_id === TASK_A)).toHaveLength(0);
    });

    it('archives a habit and lists it under archived habits', async () => {
        setup();
        await screen.findAllByText('Read 10 pages');

        fireEvent.click(screen.getAllByTitle('Archive or delete habit')[0]);
        fireEvent.click(screen.getByRole('button', { name: 'Archive' }));

        await waitFor(() => expect(fake.calls.some((c) => c.table === 'tasks' && c.op === 'update')).toBe(true));
        expect(await screen.findByText('Archived habits (1)')).toBeTruthy();
        expect(fake.db.tasks.find((t) => t.id === TASK_A)?.archived).toBe(true);
    });

    it('filters habits by category', async () => {
        setup();
        await screen.findAllByText('Read 10 pages');

        fireEvent.click(screen.getByRole('button', { name: 'Work' }));

        expect(screen.queryAllByText('Read 10 pages')).toHaveLength(0);
        expect(screen.getAllByText('Deep work').length).toBeGreaterThan(0);
    });

    it('offers the starter plan only when habits loaded and there are none', async () => {
        setup({ tasks: [], entries: [], task_shares: [] });
        expect(await screen.findByText('Import Starter Habit Plan')).toBeTruthy();
    });

    describe('shared habits (per-person check-ins)', () => {
        const PARTNER = 'user-2';
        const TASK_SHARED_BY_ME = 'dddddddd-0000-4000-8000-000000000004';
        const TASK_SHARED_WITH_ME = 'eeeeeeee-0000-4000-8000-000000000005';

        function sharedDb() {
            const db = seedDb();
            const base = { archived: false, schedule_mask: 127, created_at: '2026-09-01T08:00:00.000Z', category: 'Health' };
            db.tasks.push(
                { ...base, id: TASK_SHARED_BY_ME, user_id: USER.id, name: 'Morning run', sort_order: 3 },
                { ...base, id: TASK_SHARED_WITH_ME, user_id: PARTNER, name: 'Partner yoga', sort_order: 0 }
            );
            db.task_shares.push({ id: 's1', task_id: TASK_SHARED_BY_ME, shared_with_email: 'partner@example.com' });
            // The partner completed "Morning run" yesterday and today
            for (const d of ['2026-10-13', TODAY]) {
                db.entries.push({ id: `p-${d}`, task_id: TASK_SHARED_BY_ME, user_id: PARTNER, entry_date: d, completed: true });
            }
            return db;
        }

        it("shows the partner's check-ins as read-only badges, not as your own", async () => {
            setup(sharedDb());
            await screen.findAllByText('Morning run');

            cell('Morning run', TODAY).forEach((b) => expect(b.getAttribute('aria-pressed')).toBe('false'));
            expect(screen.getAllByRole('img', { name: '1 partner completed this day' }).length).toBeGreaterThan(0);
            // The partner's two days don't give *you* a streak
            expect(screen.queryAllByText('2d')).toHaveLength(0);
        });

        it('shows live check-ins from partners and from your other devices', async () => {
            setup(sharedDb());
            await screen.findAllByText('Morning run');
            const partnerBadges = () => screen.queryAllByRole('img', { name: '1 partner completed this day' }).length;
            const before = partnerBadges();

            // The partner unticks today
            act(() => fake.emit('entries', {
                eventType: 'UPDATE',
                new: { task_id: TASK_SHARED_BY_ME, user_id: PARTNER, entry_date: TODAY, completed: false, note: null },
                old: {},
            }));
            await waitFor(() => expect(partnerBadges()).toBeLessThan(before));

            // You tick "Drink water" on your phone
            act(() => fake.emit('entries', {
                eventType: 'INSERT',
                new: { task_id: TASK_B, user_id: USER.id, entry_date: TODAY, completed: true, note: null },
                old: {},
            }));
            await waitFor(() => cell('Drink water', TODAY).forEach((b) => expect(b.getAttribute('aria-pressed')).toBe('true')));
        });

        it("ticking your box adds your own row and leaves the partner's untouched", async () => {
            setup(sharedDb());
            await screen.findAllByText('Morning run');

            fireEvent.click(cell('Morning run', TODAY)[0]);

            await waitFor(() => expect(upserts()).toHaveLength(1));
            expect(upserts()[0].payload).toMatchObject({ task_id: TASK_SHARED_BY_ME, user_id: USER.id, entry_date: TODAY, completed: true });
            const rowsToday = fake.db.entries.filter((e) => e.task_id === TASK_SHARED_BY_ME && e.entry_date === TODAY);
            expect(rowsToday.map((e) => e.user_id).sort()).toEqual([PARTNER, USER.id].sort());
        });

        it('lets you reorder only your own habits', async () => {
            setup(sharedDb());
            await screen.findAllByText('Partner yoga');

            // Owner-only menu: no options for the habit shared with you
            expect(screen.getAllByTitle('Habit Options')).toHaveLength(4);

            fireEvent.click(screen.getAllByTitle('Habit Options')[0]); // "Read 10 pages" card
            fireEvent.click(screen.getByRole('button', { name: 'Move Read 10 pages down' }));

            await waitFor(() => expect(reorderCalls).toHaveLength(1));
            // Only your habits, in the new order; the partner's habit is never sent
            expect(reorderCalls[0]).toEqual([TASK_B, TASK_A, TASK_C, TASK_SHARED_BY_ME]);
        });
    });

    it('shows a retry state instead of the starter plan when loading fails', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        setup(seedDb(), (c) => (c.table === 'tasks' && c.op === 'select' ? { message: 'boom' } : null));
        expect(await screen.findByText('Could not load your habits.')).toBeTruthy();
        expect(screen.queryByText('Import Starter Habit Plan')).toBeNull();
        expect(consoleError).toHaveBeenCalledWith('Error fetching data:', { message: 'boom' });
    });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { createFakeSupabase } from './helpers/fakeSupabase';

const holder = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => holder.client }));

import DailyTasksView from '@/components/tasks/DailyTasksView';

const USER = 'user-1';
const TODAY = '2026-10-20';
const TOMORROW = '2026-10-21';

let fake: ReturnType<typeof createFakeSupabase>;

function setup(rows: Record<string, unknown>[] = []) {
    fake = createFakeSupabase({ daily_tasks: rows });
    holder.client = fake.client;
    return render(<DailyTasksView userId={USER} />);
}

const task = (id: string, title: string, extra: Record<string, unknown> = {}) => ({
    id, user_id: USER, title, task_date: TODAY, completed: false, completed_at: null, moved_from: null,
    created_at: `${TODAY}T08:00:00.000Z`, ...extra,
});

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 20, 9, 0, 0));
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

describe('Daily tasks', () => {
    it("shows only today's tasks", async () => {
        setup([task('a', 'Buy milk'), task('b', 'Old task', { task_date: '2026-10-19' }), task('c', 'Future', { task_date: TOMORROW })]);
        expect(await screen.findByText('Buy milk')).toBeTruthy();
        expect(screen.queryByText('Old task')).toBeNull();
        expect(screen.queryByText('Future')).toBeNull();
    });

    it('adds a typed task to today', async () => {
        setup();
        await screen.findByText('Nothing planned yet');
        fireEvent.change(screen.getByRole('textbox', { name: 'New task' }), { target: { value: '  Call the bank  ' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add' }));

        expect(await screen.findByText('Call the bank')).toBeTruthy();
        expect(fake.db.daily_tasks).toEqual([expect.objectContaining({ title: 'Call the bank', task_date: TODAY, user_id: USER })]);
        expect((screen.getByRole('textbox', { name: 'New task' }) as HTMLInputElement).value).toBe('');
    });

    it('adds a spoken task with the microphone', async () => {
        let session: { onstart?: () => void; onresult?: (e: unknown) => void; onend?: () => void } = {};
        (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = class {
            constructor() { session = this as typeof session; }
            start() { session.onstart?.(); }
            stop() { session.onend?.(); }
        };
        setup();
        await screen.findByText('Nothing planned yet');

        fireEvent.click(screen.getByRole('button', { name: 'Speak instead of typing' }));
        act(() => {
            session.onresult?.({ results: [[{ transcript: 'water the plants' }]] });
            session.onend?.();
        });
        expect((screen.getByRole('textbox', { name: 'New task' }) as HTMLInputElement).value).toBe('water the plants');
    });

    it('explains why the microphone did not work', async () => {
        let session: { onerror?: (e: { error: string }) => void; onend?: () => void } = {};
        (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = class {
            constructor() { session = this as typeof session; }
            start() {}
            stop() { session.onend?.(); }
        };
        setup();
        await screen.findByText('Nothing planned yet');

        fireEvent.click(screen.getByRole('button', { name: 'Speak instead of typing' }));
        act(() => session.onerror?.({ error: 'not-allowed' }));
        expect((await screen.findByRole('alert')).textContent).toMatch(/Microphone access is blocked/);

        delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
        fireEvent.click(screen.getByRole('button', { name: 'Speak instead of typing' }));
        expect((await screen.findByRole('alert')).textContent).toMatch(/doesn't support voice input/);
    });

    it('ticks a task as done and moves it to the Done section', async () => {
        setup([task('a', 'Buy milk')]);
        const box = await screen.findByRole('checkbox', { name: 'Mark "Buy milk" as done' });
        fireEvent.click(box);

        await waitFor(() => expect(fake.db.daily_tasks[0].completed).toBe(true));
        expect(screen.getByRole('checkbox', { name: 'Mark "Buy milk" as not done' }).getAttribute('aria-checked')).toBe('true');
        expect(screen.getByText('1 of 1 done')).toBeTruthy();
    });

    it('moves an unfinished task to tomorrow: gone today, there tomorrow', async () => {
        setup([task('a', 'Write report')]);
        fireEvent.click(await screen.findByRole('button', { name: 'Move "Write report" to tomorrow' }));

        await waitFor(() => expect(screen.queryByText('Write report')).toBeNull());
        expect(fake.db.daily_tasks[0]).toMatchObject({ task_date: TOMORROW, moved_from: TODAY });

        // Next day: the moved task shows up, labelled as coming from yesterday
        cleanup();
        vi.setSystemTime(new Date(2026, 9, 21, 9, 0, 0));
        holder.client = fake.client;
        render(<DailyTasksView userId={USER} />);
        expect(await screen.findByText('Write report')).toBeTruthy();
        expect(screen.getByText('From yesterday')).toBeTruthy();
    });

    it('completed tasks cannot be moved, only deleted', async () => {
        setup([task('a', 'Done thing', { completed: true })]);
        await screen.findByText('Done thing');
        expect(screen.queryByRole('button', { name: 'Move "Done thing" to tomorrow' })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Delete "Done thing"' }));
        await waitFor(() => expect(fake.db.daily_tasks).toHaveLength(0));
    });

    it('restores the list and shows an error when a save fails', async () => {
        fake = createFakeSupabase({ daily_tasks: [task('a', 'Buy milk')] }, {
            failOn: (c) => (c.op === 'delete' ? { message: 'offline' } : null),
        });
        holder.client = fake.client;
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        render(<DailyTasksView userId={USER} />);

        fireEvent.click(await screen.findByRole('button', { name: 'Delete "Buy milk"' }));
        expect(await screen.findByText('Could not delete the task. Please try again.')).toBeTruthy();
        expect(screen.getByText('Buy milk')).toBeTruthy();
        expect(consoleError).toHaveBeenCalled();
    });
});

describe('Daily tasks from habits', () => {
    const HABIT = 'aaaaaaaa-0000-4000-8000-000000000001';
    const OTHER = 'bbbbbbbb-0000-4000-8000-000000000002';
    const habit = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
        id, user_id: USER, name, category: 'Health', sort_order: 0, archived: false, schedule_mask: 127,
        created_at: '2026-09-01T08:00:00.000Z', ...extra,
    });

    function setupWithHabits(db: Record<string, Record<string, unknown>[]>) {
        fake = createFakeSupabase({ daily_tasks: [], entries: [], ...db });
        holder.client = fake.client;
        return render(<DailyTasksView userId={USER} />);
    }

    it('searches your habits and adds the picked one to today', async () => {
        setupWithHabits({ tasks: [habit(HABIT, 'Drink water'), habit(OTHER, 'Read 10 pages', { category: 'Personal' })] });
        await screen.findByText('Nothing planned yet');

        const search = screen.getByRole('combobox', { name: 'Add from your habits' });
        fireEvent.focus(search);
        fireEvent.change(search, { target: { value: 'read' } });
        expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([expect.stringContaining('Read 10 pages')]);

        fireEvent.click(screen.getByRole('option', { name: /Read 10 pages/ }));

        expect(await screen.findByText('Read 10 pages')).toBeTruthy();
        expect(fake.db.daily_tasks[0]).toMatchObject({ title: 'Read 10 pages', habit_id: OTHER, task_date: TODAY, completed: false });
        // Already on the list, so it's no longer offered
        fireEvent.focus(search);
        expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([expect.stringContaining('Drink water')]);
    });

    it('completing a habit task checks the habit in, and unticking undoes it', async () => {
        setupWithHabits({ tasks: [habit(HABIT, 'Drink water')], daily_tasks: [task('t1', 'Drink water', { habit_id: HABIT })] });
        fireEvent.click(await screen.findByRole('checkbox', { name: 'Mark "Drink water" as done' }));

        await waitFor(() => expect(fake.db.entries).toEqual([expect.objectContaining({ task_id: HABIT, user_id: USER, entry_date: TODAY, completed: true })]));

        fireEvent.click(await screen.findByRole('checkbox', { name: 'Mark "Drink water" as not done' }));
        await waitFor(() => expect(fake.db.entries[0].completed).toBe(false));
    });

    it('picks up a habit ticked elsewhere when the app comes back to the foreground', async () => {
        setupWithHabits({ tasks: [habit(HABIT, 'Drink water')], daily_tasks: [task('t1', 'Drink water', { habit_id: HABIT })] });
        await screen.findByRole('checkbox', { name: 'Mark "Drink water" as done' });

        // Ticked on the Habits page; the sync_habit_tasks trigger completes the linked task
        fake.db.daily_tasks[0].completed = true;
        act(() => window.dispatchEvent(new Event('focus')));

        expect(await screen.findByRole('checkbox', { name: 'Mark "Drink water" as not done' })).toBeTruthy();
    });

    it('plain tasks never touch habits', async () => {
        setupWithHabits({ tasks: [habit(HABIT, 'Drink water')], daily_tasks: [task('t1', 'Call bank')] });
        fireEvent.click(await screen.findByRole('checkbox', { name: 'Mark "Call bank" as done' }));
        await waitFor(() => expect(fake.db.daily_tasks[0].completed).toBe(true));
        expect(fake.db.entries).toEqual([]);
    });
});

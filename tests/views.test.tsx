// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { createFakeSupabase } from './helpers/fakeSupabase';

// Smoke tests for the History and Analytics views on top of the in-memory Supabase fake

const holder = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => holder.client }));

// jsdom has no layout, so ResponsiveContainer would measure 0x0; give the chart a fixed size instead
vi.mock('recharts', async (importOriginal) => {
    const recharts = await importOriginal<typeof import('recharts')>();
    const { cloneElement } = await import('react');
    return {
        ...recharts,
        ResponsiveContainer: ({ children }: { children: React.ReactElement<{ width?: number; height?: number }> }) =>
            cloneElement(children, { width: 800, height: 256 }),
    };
});

import HistoryView from '@/components/history/HistoryView';
import AnalyticsView from '@/components/analytics/AnalyticsView';

const USER_ID = 'user-1';
const TASK_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const TASK_B = 'bbbbbbbb-0000-4000-8000-000000000002';

function seed() {
    return {
        tasks: [
            // Long-standing habit, done every day for the last 10 days
            { id: TASK_A, user_id: USER_ID, name: 'Read 10 pages', category: 'Personal', sort_order: 0, archived: false, created_at: '2026-08-01T08:00:00.000Z' },
            // Created yesterday and done both days: its rate must not be diluted by days before it existed
            { id: TASK_B, user_id: USER_ID, name: 'Drink water', category: 'Health', sort_order: 1, archived: false, created_at: '2026-10-13T08:00:00.000Z' },
        ],
        entries: [
            ...Array.from({ length: 10 }, (_, i) => ({ task_id: TASK_A, user_id: USER_ID, entry_date: `2026-10-${String(i + 5).padStart(2, '0')}`, completed: true })),
            { task_id: TASK_B, user_id: USER_ID, entry_date: '2026-10-13', completed: true },
            { task_id: TASK_B, user_id: USER_ID, entry_date: '2026-10-14', completed: true },
        ],
        task_shares: [],
    };
}

let fake: ReturnType<typeof createFakeSupabase>;

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 14, 12, 0, 0));
    fake = createFakeSupabase(seed(), {
        rpc: {
            get_task_streak_stats: () => ({
                data: [
                    { task_id: TASK_A, current_streak: 10, longest_streak: 10, first_completed: '2026-10-05' },
                    { task_id: TASK_B, current_streak: 2, longest_streak: 2, first_completed: '2026-10-13' },
                ],
                error: null,
            }),
        },
    });
    holder.client = fake.client;
});

afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

describe('History view', () => {
    it('shows the month and saves a toggle', async () => {
        render(<HistoryView userId={USER_ID} />);
        expect((await screen.findAllByText('Read 10 pages')).length).toBeGreaterThan(0);
        expect(screen.getByText('Oct 2026')).toBeTruthy();

        screen.getAllByRole('button', { name: 'Read 10 pages, 2026-10-05' })
            .forEach((b) => expect(b.getAttribute('aria-pressed')).toBe('true'));

        fireEvent.click(screen.getAllByRole('button', { name: 'Drink water, 2026-10-12' })[0]);
        await waitFor(() => expect(fake.calls.some((c) => c.table === 'entries' && c.op === 'upsert')).toBe(true));
        await waitFor(() => screen.getAllByRole('button', { name: 'Drink water, 2026-10-12' })
            .forEach((b) => expect(b.getAttribute('aria-pressed')).toBe('true')));
    });
});

describe('Analytics view', () => {
    it('shows server streaks and creation-aware completion rates', async () => {
        render(<AnalyticsView userId={USER_ID} />);

        expect(await screen.findByText('10d streak')).toBeTruthy();
        expect(screen.getByText('2d streak')).toBeTruthy();
        // Habit created yesterday and done both days: 100%, not 2/30
        const rates = screen.getAllByText(/^\d+%$/).map((el) => el.textContent);
        expect(rates).toContain('100%');
        // 7-day badge unlocked by the 10-day streak
        expect(screen.getByText('1 / 2 Habits Unlocked')).toBeTruthy();
    });

    it('pages through completions instead of stopping at the API row cap', async () => {
        render(<AnalyticsView userId={USER_ID} />);
        await screen.findByText('10d streak');
        const entryPages = fake.calls.filter((c) => c.table === 'entries' && c.op === 'select');
        // One page with data, then an empty page that ends the loop
        expect(entryPages.length).toBe(2);
    });
});

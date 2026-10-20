import { describe, it, expect } from 'vitest';
import { calculateTaskStreak, streakWindowStart, streakCarryInAnchor, STREAK_WINDOW_DAYS } from '@/lib/streaks';

const NOW = new Date(2026, 9, 14, 12, 0, 0); // Wed 14 Oct 2026, local time

// isDone backed by a set of 'yyyy-MM-dd' dates for one task
const doneOn = (dates: string[]) => {
    const set = new Set(dates);
    return (_taskId: string, dateStr: string) => set.has(dateStr);
};

describe('streak window', () => {
    it('covers STREAK_WINDOW_DAYS days ending today, anchored the day before', () => {
        expect(STREAK_WINDOW_DAYS).toBe(14);
        expect(streakWindowStart(NOW)).toBe('2026-10-01');
        expect(streakCarryInAnchor(NOW)).toBe('2026-09-30');
    });
});

describe('calculateTaskStreak', () => {
    it('is 0 with no completions', () => {
        expect(calculateTaskStreak('t', doneOn([]), 0, NOW)).toBe(0);
    });

    it('counts consecutive days ending today', () => {
        expect(calculateTaskStreak('t', doneOn(['2026-10-12', '2026-10-13', '2026-10-14']), 0, NOW)).toBe(3);
    });

    it('keeps a streak alive from yesterday when today is not done yet', () => {
        expect(calculateTaskStreak('t', doneOn(['2026-10-12', '2026-10-13']), 0, NOW)).toBe(2);
    });

    it('is 0 when the last completion was two days ago', () => {
        expect(calculateTaskStreak('t', doneOn(['2026-10-11', '2026-10-12']), 0, NOW)).toBe(0);
    });

    it('stops at a gap', () => {
        expect(calculateTaskStreak('t', doneOn(['2026-10-10', '2026-10-12', '2026-10-13', '2026-10-14']), 0, NOW)).toBe(3);
    });

    it('adds the carry-in when every day in the window is done', () => {
        const all14 = Array.from({ length: 14 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`);
        expect(calculateTaskStreak('t', doneOn(all14), 30, NOW)).toBe(44);
    });

    it('adds the carry-in when today is open but yesterday back to the window start are done', () => {
        const oct1to13 = Array.from({ length: 13 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`);
        expect(calculateTaskStreak('t', doneOn(oct1to13), 10, NOW)).toBe(23);
    });

    it('ignores the carry-in when the run breaks inside the window', () => {
        const withGap = ['2026-10-01', '2026-10-02', '2026-10-04', '2026-10-05'];
        expect(calculateTaskStreak('t', doneOn(withGap), 50, NOW)).toBe(0);
    });
});

describe('calculateTaskStreak with a schedule', () => {
    const MWF = 0b0101010; // Mon, Wed, Fri (same cases as the SQL tests)
    const done = doneOn(['2026-10-12', '2026-10-14', '2026-10-16']);

    it('a day off neither counts nor breaks the streak', () => {
        expect(calculateTaskStreak('t', done, 0, new Date(2026, 9, 18, 12), MWF)).toBe(3); // Sunday
    });

    it('a due day that is not done yet keeps the streak alive', () => {
        expect(calculateTaskStreak('t', done, 0, new Date(2026, 9, 19, 12), MWF)).toBe(3); // Monday
    });

    it('a missed due day breaks it', () => {
        expect(calculateTaskStreak('t', done, 0, new Date(2026, 9, 20, 12), MWF)).toBe(0); // Tuesday
    });

    it('ticks on days off are ignored', () => {
        const withExtra = doneOn(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-16']);
        expect(calculateTaskStreak('t', withExtra, 0, new Date(2026, 9, 18, 12), MWF)).toBe(3);
    });
});

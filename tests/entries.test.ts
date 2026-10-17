import { describe, it, expect } from 'vitest';
import { applyEntryChange, applyOfflineQueue, nextSortOrder, sortByOrder } from '@/lib/entries';
import type { Entry } from '@/lib/types';

describe('applyEntryChange', () => {
    const base: Entry[] = [{ id: 'e1', task_id: 'a', entry_date: '2026-10-14', completed: true }];

    it('updates an existing cell without mutating the input', () => {
        const result = applyEntryChange(base, 'a', '2026-10-14', false);
        expect(result).toEqual([{ id: 'e1', task_id: 'a', entry_date: '2026-10-14', completed: false }]);
        expect(base[0].completed).toBe(true);
        expect(result).not.toBe(base);
    });

    it('inserts a missing cell', () => {
        expect(applyEntryChange(base, 'b', '2026-10-14', true)).toHaveLength(2);
    });
});

describe('applyOfflineQueue', () => {
    it('applies queued changes in order, the last one winning', () => {
        const result = applyOfflineQueue([], [
            { task_id: 'a', entry_date: '2026-10-14', completed: true, timestamp: 't1' },
            { task_id: 'a', entry_date: '2026-10-14', completed: false, timestamp: 't2' },
            { task_id: 'b', entry_date: '2026-10-13', completed: true, timestamp: 't3' },
        ]);
        expect(result).toEqual([
            { task_id: 'a', entry_date: '2026-10-14', completed: false },
            { task_id: 'b', entry_date: '2026-10-13', completed: true },
        ]);
    });
});

describe('sort order helpers', () => {
    const tasks = [
        { sort_order: 2, created_at: '2026-01-01' },
        { sort_order: 0, created_at: '2026-01-03' },
        { sort_order: 0, created_at: '2026-01-02' },
    ];

    it('nextSortOrder is one past the max (0 for an empty list)', () => {
        expect(nextSortOrder(tasks)).toBe(3);
        expect(nextSortOrder([])).toBe(0);
    });

    it('sortByOrder sorts by sort_order then created_at, without mutating', () => {
        expect(sortByOrder(tasks).map((t) => t.created_at)).toEqual(['2026-01-02', '2026-01-03', '2026-01-01']);
        expect(tasks[0].sort_order).toBe(2);
    });
});

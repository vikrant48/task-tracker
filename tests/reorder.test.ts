import { describe, it, expect } from 'vitest';
import { dragTask, moveTask, ownedTaskIds, withOwnedSortOrder } from '@/lib/reorder';
import type { Task } from '@/lib/types';

const ME = 'me';
const task = (id: string, user_id: string, category = 'General', sort_order = 0): Task =>
    ({ id, user_id, name: id, category, sort_order, archived: false, created_at: '2026-01-01' });

// a, b, d are mine; c is shared with me by someone else
const tasks = [task('a', ME), task('b', ME), task('c', 'partner'), task('d', ME, 'Work')];
const ids = (list: Task[] | null) => list?.map((t) => t.id);

describe('reorder helpers', () => {
    it('ownedTaskIds lists only my habits, in order', () => {
        expect(ownedTaskIds(tasks, ME)).toEqual(['a', 'b', 'd']);
    });

    it('withOwnedSortOrder renumbers only my habits', () => {
        const result = withOwnedSortOrder([task('b', ME, 'G', 5), task('c', 'partner', 'G', 9), task('a', ME, 'G', 1)], ME);
        expect(result.map((t) => t.sort_order)).toEqual([0, 9, 1]);
    });

    it('dragTask moves my habit onto another of mine', () => {
        expect(ids(dragTask(tasks, 'd', 'a', ME))).toEqual(['d', 'a', 'b', 'c']);
    });

    it("dragTask refuses to move or target someone else's habit", () => {
        expect(dragTask(tasks, 'c', 'a', ME)).toBeNull();
        expect(dragTask(tasks, 'a', 'c', ME)).toBeNull();
        expect(dragTask(tasks, 'a', 'a', ME)).toBeNull();
    });

    it("moveTask skips over habits shared with me", () => {
        expect(ids(moveTask(tasks, tasks, 'b', 1, ME))).toEqual(['a', 'd', 'c', 'b']);
    });

    it('moveTask respects the visible (filtered) list', () => {
        const visible = tasks.filter((t) => t.category === 'General'); // a, b, c
        expect(ids(moveTask(tasks, visible, 'a', 1, ME))).toEqual(['b', 'a', 'c', 'd']);
        expect(moveTask(tasks, visible, 'b', 1, ME)).toBeNull(); // nothing of mine below b in this filter
    });

    it('moveTask returns null at the edges', () => {
        expect(moveTask(tasks, tasks, 'a', -1, ME)).toBeNull();
        expect(moveTask(tasks, tasks, 'd', 1, ME)).toBeNull();
    });
});

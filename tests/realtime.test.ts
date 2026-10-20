import { describe, it, expect } from 'vitest';
import { changedRow, mergeOwnEntry, mergePartnerCheckIn } from '@/lib/realtime';

const row = { task_id: 't1', user_id: 'u2', entry_date: '2026-10-14', completed: true, note: null };

describe('realtime entry merging', () => {
    it('reads the new row for inserts/updates and the old row for deletes', () => {
        expect(changedRow({ eventType: 'INSERT', new: row, old: {} })).toEqual({ row, deleted: false });
        expect(changedRow({ eventType: 'DELETE', new: {}, old: row })).toEqual({ row, deleted: true });
        expect(changedRow({ eventType: 'DELETE', new: {}, old: { task_id: 't1' } })).toBeNull();
    });

    it('replaces or removes your own entry without duplicating it', () => {
        const list = [{ task_id: 't1', entry_date: '2026-10-14', completed: false }];
        expect(mergeOwnEntry(list, { ...row, note: 'hi' }, false)).toEqual([
            { task_id: 't1', entry_date: '2026-10-14', completed: true, note: 'hi' },
        ]);
        expect(mergeOwnEntry(list, row, true)).toEqual([]);
        expect(list).toHaveLength(1);
    });

    it("keeps only partners' completed days", () => {
        const added = mergePartnerCheckIn([], row, false);
        expect(added).toEqual([{ task_id: 't1', user_id: 'u2', entry_date: '2026-10-14' }]);
        expect(mergePartnerCheckIn(added, row, false)).toHaveLength(1);
        expect(mergePartnerCheckIn(added, { ...row, completed: false }, false)).toEqual([]);
        expect(mergePartnerCheckIn(added, row, true)).toEqual([]);
    });
});

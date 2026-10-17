// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { enqueueOfflineEntry, offlineQueueKey, readOfflineQueue, removeSyncedEntries, writeOfflineQueue } from '@/lib/offline-queue';

const USER = 'user-1';
const item = (task: string, date: string, completed: boolean, timestamp: string) =>
    ({ task_id: task, entry_date: date, completed, timestamp });

beforeEach(() => localStorage.clear());

describe('offline queue', () => {
    it('is scoped per user', () => {
        enqueueOfflineEntry(USER, item('a', '2026-10-14', true, 't1'));
        expect(readOfflineQueue('someone-else')).toEqual([]);
        expect(readOfflineQueue(USER)).toHaveLength(1);
    });

    it('returns [] for missing or corrupted data', () => {
        expect(readOfflineQueue(USER)).toEqual([]);
        localStorage.setItem(offlineQueueKey(USER), '{not json');
        expect(readOfflineQueue(USER)).toEqual([]);
        localStorage.setItem(offlineQueueKey(USER), '{"a":1}');
        expect(readOfflineQueue(USER)).toEqual([]);
    });

    it('keeps only the latest change per cell', () => {
        enqueueOfflineEntry(USER, item('a', '2026-10-14', true, 't1'));
        const queue = enqueueOfflineEntry(USER, item('a', '2026-10-14', false, 't2'));
        expect(queue).toEqual([item('a', '2026-10-14', false, 't2')]);
    });

    it('removes the key when the queue is emptied', () => {
        writeOfflineQueue(USER, [item('a', '2026-10-14', true, 't1')]);
        writeOfflineQueue(USER, []);
        expect(localStorage.getItem(offlineQueueKey(USER))).toBeNull();
    });

    it('after a sync, keeps edits that were queued while it was in flight', () => {
        const synced = [item('a', '2026-10-14', true, 't1')];
        writeOfflineQueue(USER, synced);
        // While the upload runs, the same cell is changed again and another cell is added
        enqueueOfflineEntry(USER, item('a', '2026-10-14', false, 't2'));
        enqueueOfflineEntry(USER, item('b', '2026-10-13', true, 't3'));

        const remaining = removeSyncedEntries(USER, synced);
        expect(remaining).toEqual([item('a', '2026-10-14', false, 't2'), item('b', '2026-10-13', true, 't3')]);
    });
});

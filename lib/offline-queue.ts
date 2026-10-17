import type { QueuedEntry } from '@/lib/types';

// Offline check-ins are persisted per user in localStorage until they sync.

// Postgres errors that mean a queued entry can never sync (task deleted / access revoked)
export const UNSYNCABLE_ERROR_CODES = ['23503', '42501'];

export const offlineQueueKey = (userId: string) => `focusflow_offline_queue_${userId}`;

// Fired on window whenever this tab changes the queue (other tabs get the native 'storage' event)
export const OFFLINE_QUEUE_EVENT = 'focusflow-offline-queue';

export function readOfflineQueue(userId: string): QueuedEntry[] {
    try {
        const raw = localStorage.getItem(offlineQueueKey(userId));
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function writeOfflineQueue(userId: string, queue: QueuedEntry[]) {
    try {
        if (queue.length > 0) {
            localStorage.setItem(offlineQueueKey(userId), JSON.stringify(queue));
        } else {
            localStorage.removeItem(offlineQueueKey(userId));
        }
    } catch (e) {
        console.error('Could not persist offline queue:', e);
    }
    window.dispatchEvent(new Event(OFFLINE_QUEUE_EVENT));
}

// Add a check-in, replacing any earlier queued change to the same cell. Returns the new queue.
export function enqueueOfflineEntry(userId: string, item: QueuedEntry): QueuedEntry[] {
    const queue = readOfflineQueue(userId).filter(
        (q) => !(q.task_id === item.task_id && q.entry_date === item.entry_date)
    );
    queue.push(item);
    writeOfflineQueue(userId, queue);
    return queue;
}

// Drop the items that were synced. Items queued (or re-queued) while the sync was in flight are kept.
export function removeSyncedEntries(userId: string, synced: QueuedEntry[]): QueuedEntry[] {
    const remaining = readOfflineQueue(userId).filter(
        (q) => !synced.some((s) => s.task_id === q.task_id && s.entry_date === q.entry_date && s.timestamp === q.timestamp)
    );
    writeOfflineQueue(userId, remaining);
    return remaining;
}

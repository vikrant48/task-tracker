'use client';

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import type { BrowserSupabaseClient } from '@/lib/supabase/client';
import type { QueuedEntry, SyncState } from '@/lib/types';
import { ENTRY_CONFLICT_COLUMNS } from '@/lib/entries';
import {
    OFFLINE_QUEUE_EVENT,
    UNSYNCABLE_ERROR_CODES,
    enqueueOfflineEntry,
    offlineQueueKey,
    readOfflineQueue,
    removeSyncedEntries,
} from '@/lib/offline-queue';

function subscribeToConnectivity(onChange: () => void) {
    window.addEventListener('online', onChange);
    window.addEventListener('offline', onChange);
    return () => {
        window.removeEventListener('online', onChange);
        window.removeEventListener('offline', onChange);
    };
}

function subscribeToQueue(onChange: () => void) {
    window.addEventListener(OFFLINE_QUEUE_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
        window.removeEventListener(OFFLINE_QUEUE_EVENT, onChange);
        window.removeEventListener('storage', onChange);
    };
}

// Tracks connectivity, persists offline check-ins, and uploads them on load and on reconnect.
// Both connectivity and the queue (in localStorage) are read as external stores, so the UI
// always reflects them without mirroring them into React state.
export function useOfflineSync(supabase: BrowserSupabaseClient, userId: string, onError: (message: string) => void) {
    // Server render assumes online with nothing queued; real values are read on the client
    const isOnline = useSyncExternalStore(subscribeToConnectivity, () => navigator.onLine, () => true);
    const hasQueuedEdits = useSyncExternalStore(
        subscribeToQueue,
        () => {
            try {
                return localStorage.getItem(offlineQueueKey(userId)) !== null;
            } catch {
                return false;
            }
        },
        () => false
    );
    const syncingRef = useRef(false);

    // Guards against overlapping uploads; "Syncing" is shown while anything is queued
    const sync = useCallback(async () => {
        if (!navigator.onLine || syncingRef.current) return;

        const pending = readOfflineQueue(userId);
        if (pending.length === 0) return;

        const toPayload = (items: QueuedEntry[]) => items.map((item) => ({
            task_id: item.task_id,
            user_id: userId,
            entry_date: item.entry_date,
            completed: item.completed,
            completed_at: item.completed ? item.timestamp : null,
        }));

        try {
            syncingRef.current = true;

            const { error: syncError } = await supabase
                .from('entries')
                .upsert(toPayload(pending), { onConflict: ENTRY_CONFLICT_COLUMNS });

            if (syncError && UNSYNCABLE_ERROR_CODES.includes(syncError.code)) {
                // One bad item (task deleted / unshared) fails the whole batch: retry individually and drop those
                for (const item of pending) {
                    const { error: itemError } = await supabase
                        .from('entries')
                        .upsert(toPayload([item]), { onConflict: ENTRY_CONFLICT_COLUMNS });
                    if (itemError && !UNSYNCABLE_ERROR_CODES.includes(itemError.code)) throw itemError;
                }
            } else if (syncError) {
                throw syncError;
            }

            removeSyncedEntries(userId, pending);
        } catch (err) {
            console.error('Error syncing offline queue:', err);
            onError('Failed to sync offline edits. They are saved on this device and will retry when you reconnect.');
        } finally {
            syncingRef.current = false;
        }
    }, [supabase, userId, onError]);

    // Flush edits saved by a previous session, and again whenever the connection comes back
    useEffect(() => {
        if (isOnline) sync();
    }, [isOnline, sync]);

    const enqueue = useCallback((item: QueuedEntry) => {
        enqueueOfflineEntry(userId, item);
    }, [userId]);

    const syncState: SyncState = !isOnline ? 'offline' : hasQueuedEdits ? 'syncing' : 'synced';

    return { isOffline: !isOnline, syncState, enqueue };
}

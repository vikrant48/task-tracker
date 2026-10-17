'use client';

import { useCallback, useMemo, useOptimistic, useRef, useTransition, type Dispatch, type SetStateAction } from 'react';
import type { BrowserSupabaseClient } from '@/lib/supabase/client';
import type { Entry, QueuedEntry } from '@/lib/types';
import { toDateStr } from '@/lib/dates';
import { applyEntryChange, ENTRY_CONFLICT_COLUMNS } from '@/lib/entries';

interface UseCheckInsOptions {
    supabase: BrowserSupabaseClient;
    userId: string;
    entries: Entry[];
    setEntries: Dispatch<SetStateAction<Entry[]>>;
    onError: (message: string) => void;
    // Queues check-ins made while offline (see useOfflineSync)
    enqueue: (item: QueuedEntry) => void;
    // Called after a check-in is saved or queued
    onSaved?: (taskId: string, dateStr: string, completed: boolean) => void;
}

// Ticking/unticking cells: instant (optimistic) UI, saved in the background, rolled back on failure,
// queued while offline. Repeat taps on a cell are ignored until its save settles.
export function useCheckIns({ supabase, userId, entries, setEntries, onError, enqueue, onSaved }: UseCheckInsOptions) {
    const pending = useRef(new Set<string>());
    const [checkIns, addOptimistic] = useOptimistic(
        entries,
        (state, c: { taskId: string; dateStr: string; completed: boolean }) => applyEntryChange(state, c.taskId, c.dateStr, c.completed)
    );
    const [, startTransition] = useTransition();

    const cells = useMemo(() => new Map(checkIns.map((e) => [`${e.task_id}|${e.entry_date}`, e.completed])), [checkIns]);
    const isCompleted = useCallback((taskId: string, dateStr: string) => cells.get(`${taskId}|${dateStr}`) ?? false, [cells]);

    const commit = (taskId: string, dateStr: string, completed: boolean) => {
        setEntries((prev) => applyEntryChange(prev, taskId, dateStr, completed));
        onSaved?.(taskId, dateStr, completed);
    };

    const toggle = (taskId: string, dateStr: string, currentlyCompleted: boolean) => {
        const key = `${taskId}|${dateStr}`;
        if (dateStr > toDateStr(new Date()) || pending.current.has(key)) return;

        const completed = !currentlyCompleted;
        const timestamp = new Date().toISOString();
        navigator.vibrate?.([15]);

        if (!navigator.onLine) {
            enqueue({ task_id: taskId, entry_date: dateStr, completed, timestamp });
            commit(taskId, dateStr, completed);
            return;
        }

        pending.current.add(key);
        // The optimistic value shows while this transition is pending; React then falls back to
        // `entries`, which is only updated on success (so a failure rolls back by itself)
        startTransition(async () => {
            addOptimistic({ taskId, dateStr, completed });
            try {
                const { error } = await supabase.from('entries').upsert(
                    { task_id: taskId, user_id: userId, entry_date: dateStr, completed, completed_at: completed ? timestamp : null },
                    { onConflict: ENTRY_CONFLICT_COLUMNS }
                );
                if (error) throw error;
                commit(taskId, dateStr, completed);
            } catch (err) {
                console.error('Error toggling entry:', err);
                onError('Connection error. Your change was not saved.');
            } finally {
                pending.current.delete(key);
            }
        });
    };

    return { checkIns, isCompleted, toggle };
}

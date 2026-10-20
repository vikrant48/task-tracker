'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BrowserSupabaseClient } from '@/lib/supabase/client';
import type { Entry } from '@/lib/types';
import { toDateStr } from '@/lib/dates';
import { applyEntryChange, applyOfflineQueue } from '@/lib/entries';
import { readOfflineQueue } from '@/lib/offline-queue';
import { calculateTaskStreak, streakCarryInAnchor, streakWindowStart } from '@/lib/streaks';
import { EVERY_DAY } from '@/lib/schedule';

// Current streaks that don't depend on which week is being viewed: the last STREAK_WINDOW_DAYS of
// entries are loaded here, `visibleEntries` (the viewed week incl. optimistic changes) overrides them,
// and anything older comes from the get_streak_carry_in() database function.
// `scheduleOf` returns a habit's schedule mask, so days off are skipped rather than breaking a streak.
export function useStreaks(
    supabase: BrowserSupabaseClient,
    userId: string,
    visibleEntries: Entry[],
    scheduleOf: (taskId: string) => number = () => EVERY_DAY
) {
    const [recentEntries, setRecentEntries] = useState<Entry[]>([]);
    const [carryIn, setCarryIn] = useState<Record<string, number>>({});
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;

        async function fetchStreakData() {
            const now = new Date();
            const [recentResult, carryInResult] = await Promise.all([
                supabase
                    .from('entries')
                    .select('task_id, entry_date, completed')
                    .eq('user_id', userId)
                    .gte('entry_date', streakWindowStart(now))
                    .lte('entry_date', toDateStr(now)),
                supabase.rpc('get_streak_carry_in', { p_anchor: streakCarryInAnchor(now) }),
            ]);

            if (cancelled) return;

            if (recentResult.error) {
                console.error('Error fetching recent entries for streaks:', recentResult.error);
            } else {
                setRecentEntries(applyOfflineQueue(recentResult.data || [], readOfflineQueue(userId)));
            }

            if (carryInResult.error) {
                // Streaks still work without it, capped at the local window
                console.warn('Streak carry-in unavailable:', carryInResult.error.message);
                setCarryIn({});
            } else {
                const map: Record<string, number> = {};
                for (const row of carryInResult.data || []) map[row.task_id] = row.run_length;
                setCarryIn(map);
            }
        }

        fetchStreakData();

        return () => {
            cancelled = true;
        };
    }, [supabase, userId, reloadKey]);

    // Completion lookup: the viewed week wins over the recent-window fetch
    const isEntryDone = useMemo(() => {
        const visible = new Map<string, boolean>();
        for (const e of visibleEntries) visible.set(`${e.task_id}|${e.entry_date}`, e.completed);
        const recent = new Map<string, boolean>();
        for (const e of recentEntries) recent.set(`${e.task_id}|${e.entry_date}`, e.completed);

        return (taskId: string, dateStr: string) => {
            const key = `${taskId}|${dateStr}`;
            return visible.get(key) ?? recent.get(key) ?? false;
        };
    }, [visibleEntries, recentEntries]);

    const getStreak = useCallback(
        (taskId: string) => calculateTaskStreak(taskId, isEntryDone, carryIn[taskId] || 0, new Date(), scheduleOf(taskId)),
        [isEntryDone, carryIn, scheduleOf]
    );

    // Keep streak data in step with a saved (or queued) change
    const recordChange = useCallback((taskId: string, dateStr: string, completed: boolean) => {
        setRecentEntries((prev) => applyEntryChange(prev, taskId, dateStr, completed));
        // Older than the local window: the server-side carry-in may have changed
        if (dateStr < streakWindowStart()) {
            setReloadKey((k) => k + 1);
        }
    }, []);

    // Re-fetch the server-side run lengths (e.g. after a habit's schedule changed)
    const reload = useCallback(() => setReloadKey((k) => k + 1), []);

    return { isEntryDone, getStreak, recordChange, reload };
}

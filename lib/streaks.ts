import { subDays } from 'date-fns';
import { toDateStr } from '@/lib/dates';

// The tracker counts streaks locally over this many recent days; anything older comes from the
// get_streak_carry_in() database function, so long streaks don't need the full history loaded.
export const STREAK_WINDOW_DAYS = 14;

export const streakWindowStart = (now: Date = new Date()) => toDateStr(subDays(now, STREAK_WINDOW_DAYS - 1));

// Day before the local window: the anchor for get_streak_carry_in()
export const streakCarryInAnchor = (now: Date = new Date()) => toDateStr(subDays(now, STREAK_WINDOW_DAYS));

// Current streak: consecutive completed days ending today (or yesterday, if today isn't done yet).
// `carryIn` is the run length ending the day before the local window.
export function calculateTaskStreak(
    taskId: string,
    isDone: (taskId: string, dateStr: string) => boolean,
    carryIn: number,
    now: Date = new Date()
): number {
    const windowStart = streakWindowStart(now);
    let checkDate = now;

    // If today is not completed yet, start from yesterday to keep the active streak counting
    if (!isDone(taskId, toDateStr(checkDate))) {
        checkDate = subDays(checkDate, 1);
    }

    let streak = 0;
    let checkStr = toDateStr(checkDate);
    while (checkStr >= windowStart) {
        if (!isDone(taskId, checkStr)) return streak;
        streak++;
        checkDate = subDays(checkDate, 1);
        checkStr = toDateStr(checkDate);
    }

    // Completed every day back to the window start: continue with the run from before the window
    return streak + carryIn;
}

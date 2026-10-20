import { subDays } from 'date-fns';
import { toDateStr } from '@/lib/dates';
import { EVERY_DAY, isDueOn } from '@/lib/schedule';

// The tracker counts streaks locally over this many recent days; anything older comes from the
// get_streak_carry_in() database function, so long streaks don't need the full history loaded.
export const STREAK_WINDOW_DAYS = 14;

export const streakWindowStart = (now: Date = new Date()) => toDateStr(subDays(now, STREAK_WINDOW_DAYS - 1));

// Day before the local window: the anchor for get_streak_carry_in()
export const streakCarryInAnchor = (now: Date = new Date()) => toDateStr(subDays(now, STREAK_WINDOW_DAYS));

// Current streak: consecutive completed DUE days ending today (or the previous due day, if today
// is due but not done yet). Days the habit isn't scheduled are skipped: they neither count nor break it.
// `carryIn` is the run length ending on the last due day before the local window.
export function calculateTaskStreak(
    taskId: string,
    isDone: (taskId: string, dateStr: string) => boolean,
    carryIn: number,
    now: Date = new Date(),
    scheduleMask: number = EVERY_DAY
): number {
    const windowStart = streakWindowStart(now);
    let checkDate = now;

    // Today is due but not completed yet: start from the day before to keep the active streak counting
    if (isDueOn(scheduleMask, checkDate) && !isDone(taskId, toDateStr(checkDate))) {
        checkDate = subDays(checkDate, 1);
    }

    let streak = 0;
    let checkStr = toDateStr(checkDate);
    while (checkStr >= windowStart) {
        if (isDueOn(scheduleMask, checkDate)) {
            if (!isDone(taskId, checkStr)) return streak;
            streak++;
        }
        checkDate = subDays(checkDate, 1);
        checkStr = toDateStr(checkDate);
    }

    // Completed every due day back to the window start: continue with the run from before the window
    return streak + carryIn;
}

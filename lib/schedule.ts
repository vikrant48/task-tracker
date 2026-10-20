import { parseISO } from 'date-fns';

// Habit schedules: bit n of `schedule_mask` = weekday n is a due day (0 = Sunday, like Date.getDay()).
// Matches public.schedule_has_day() in supabase/schema.sql.

export const EVERY_DAY = 127;
export const WEEKDAYS_ONLY = 0b0111110; // Mon–Fri
export const WEEKENDS_ONLY = 0b1000001; // Sat, Sun

// Display order starts on Monday, like the tracker's week
export const WEEKDAYS = [
    { day: 1, short: 'M', label: 'Mon' },
    { day: 2, short: 'T', label: 'Tue' },
    { day: 3, short: 'W', label: 'Wed' },
    { day: 4, short: 'T', label: 'Thu' },
    { day: 5, short: 'F', label: 'Fri' },
    { day: 6, short: 'S', label: 'Sat' },
    { day: 0, short: 'S', label: 'Sun' },
] as const;

export const isDueOn = (mask: number, date: Date | string) =>
    ((mask >> (typeof date === 'string' ? parseISO(date) : date).getDay()) & 1) === 1;

export const toggleDay = (mask: number, day: number) => mask ^ (1 << day);

export function describeSchedule(mask: number): string {
    if (mask === EVERY_DAY) return 'Every day';
    if (mask === WEEKDAYS_ONLY) return 'Weekdays';
    if (mask === WEEKENDS_ONLY) return 'Weekends';
    return WEEKDAYS.filter((d) => (mask >> d.day) & 1).map((d) => d.label).join(', ');
}

// Scheduled reminder rules, shared by the cron route and tests. Pure functions only.

export interface ReminderSetting {
    user_id: string;
    enabled: boolean;
    remind_at: string; // 'HH:MM' or 'HH:MM:SS', in the user's timezone
    timezone: string; // IANA name, e.g. 'Asia/Kolkata'
    last_sent_on: string | null; // local date of the last reminder
}

// The user's local date (YYYY-MM-DD), weekday (0 = Sunday) and minutes since midnight at `now`
export function localClock(now: Date, timezone: string): { date: string; weekday: number; minutes: number } {
    let parts: Intl.DateTimeFormatPart[];
    try {
        parts = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            weekday: 'short',
            hourCycle: 'h23',
        }).formatToParts(now);
    } catch {
        // Unknown timezone: fall back to UTC rather than skipping the user
        return localClock(now, 'UTC');
    }
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
    return {
        date: `${get('year')}-${get('month')}-${get('day')}`,
        weekday,
        minutes: Number(get('hour')) * 60 + Number(get('minute')),
    };
}

export const timeToMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + (m || 0);
};

// Due once per local day, on the first run at or after the chosen time
export function isReminderDue(setting: ReminderSetting, now: Date): boolean {
    if (!setting.enabled) return false;
    const clock = localClock(now, setting.timezone);
    return clock.minutes >= timeToMinutes(setting.remind_at) && setting.last_sent_on !== clock.date;
}

// Notification text, or null when everything is done (no nagging)
export function reminderMessage(habitsLeft: number, tasksLeft: number): { title: string; body: string } | null {
    if (habitsLeft <= 0 && tasksLeft <= 0) return null;
    const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
    const parts = [habitsLeft > 0 && plural(habitsLeft, 'habit'), tasksLeft > 0 && plural(tasksLeft, 'task')].filter(Boolean);
    return {
        title: 'FocusFlow reminder ⏰',
        body: `You still have ${parts.join(' and ')} left today. Keep your streak going!`,
    };
}

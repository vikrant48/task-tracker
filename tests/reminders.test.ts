import { describe, it, expect } from 'vitest';
import { isReminderDue, localClock, reminderMessage, type ReminderSetting } from '@/lib/reminders';

const base: ReminderSetting = { user_id: 'u1', enabled: true, remind_at: '20:00:00', timezone: 'Asia/Kolkata', last_sent_on: null };

describe('scheduled reminders', () => {
    it("reads the user's local date and time", () => {
        // 14:45 UTC = 20:15 in India (UTC+5:30), Wednesday
        expect(localClock(new Date('2026-10-14T14:45:00Z'), 'Asia/Kolkata')).toEqual({ date: '2026-10-14', weekday: 3, minutes: 20 * 60 + 15 });
        // 02:00 UTC Thursday is still Wednesday evening in New York
        expect(localClock(new Date('2026-10-15T02:00:00Z'), 'America/New_York')).toMatchObject({ date: '2026-10-14', weekday: 3 });
        expect(localClock(new Date('2026-10-14T10:00:00Z'), 'Not/AZone')).toMatchObject({ date: '2026-10-14', minutes: 600 });
    });

    it('is due once per local day, at or after the chosen time', () => {
        expect(isReminderDue(base, new Date('2026-10-14T14:15:00Z'))).toBe(false); // 19:45 local
        expect(isReminderDue(base, new Date('2026-10-14T14:30:00Z'))).toBe(true); // 20:00 local
        expect(isReminderDue({ ...base, last_sent_on: '2026-10-14' }, new Date('2026-10-14T16:00:00Z'))).toBe(false);
        expect(isReminderDue({ ...base, last_sent_on: '2026-10-13' }, new Date('2026-10-14T16:00:00Z'))).toBe(true);
        expect(isReminderDue({ ...base, enabled: false }, new Date('2026-10-14T16:00:00Z'))).toBe(false);
    });

    it('says what is left, and stays quiet when all is done', () => {
        expect(reminderMessage(2, 1)?.body).toBe('You still have 2 habits and 1 task left today. Keep your streak going!');
        expect(reminderMessage(1, 0)?.body).toContain('1 habit left');
        expect(reminderMessage(0, 0)).toBeNull();
    });
});

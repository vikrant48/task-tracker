import { describe, it, expect } from 'vitest';
import { describeSchedule, isDueOn, toggleDay, EVERY_DAY, WEEKDAYS_ONLY, WEEKENDS_ONLY } from '@/lib/schedule';

describe('schedules', () => {
    it('describes common schedules in words', () => {
        expect(describeSchedule(EVERY_DAY)).toBe('Every day');
        expect(describeSchedule(WEEKDAYS_ONLY)).toBe('Weekdays');
        expect(describeSchedule(WEEKENDS_ONLY)).toBe('Weekends');
        expect(describeSchedule(0b0101010)).toBe('Mon, Wed, Fri');
    });

    it('checks due days by weekday (2026-10-19 is a Monday)', () => {
        expect(isDueOn(WEEKDAYS_ONLY, '2026-10-19')).toBe(true);
        expect(isDueOn(WEEKDAYS_ONLY, '2026-10-18')).toBe(false);
        expect(isDueOn(EVERY_DAY, new Date(2026, 9, 18))).toBe(true);
    });

    it('toggles single days', () => {
        expect(toggleDay(EVERY_DAY, 0)).toBe(0b1111110);
        expect(toggleDay(0b1111110, 0)).toBe(EVERY_DAY);
    });
});

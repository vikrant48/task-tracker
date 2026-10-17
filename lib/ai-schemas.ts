import { z } from 'zod';
import { HABIT_CATEGORIES } from '@/lib/categories';

// Shared contract for /api/ai. The route validates with these schemas; client code should
// only `import type` from here so zod stays out of the browser bundle.

export { HABIT_CATEGORIES };

const name = z.string().trim().min(1).max(120);
const count = z.number().int().min(0).max(100_000);

// ---------- Requests ----------

const breakdownRequest = z.object({
    action: z.literal('breakdown'),
    payload: z.object({
        goal: z.string().trim().min(1).max(300),
    }),
});

const naturalLogRequest = z.object({
    action: z.literal('natural_log'),
    payload: z.object({
        input: z.string().trim().min(1).max(300),
        tasks: z.array(z.object({ id: z.string().max(64), name })).max(100),
    }),
});

const coachHabitStat = z.object({
    name,
    category: z.string().max(40),
    currentStreak: count,
    doneToday: z.boolean(),
    completedLast7: z.number().int().min(0).max(7),
});

const coachRequest = z.object({
    action: z.literal('coach'),
    payload: z.object({
        habits: z.array(coachHabitStat).max(50),
    }),
});

const weeklyHabitStat = z.object({
    name,
    category: z.string().max(40),
    currentStreak: count,
    longestStreak: count,
    // Days completed / days the habit existed, in the last 7 days and the 7 before that
    completedLast7: z.number().int().min(0).max(7),
    trackedLast7: z.number().int().min(0).max(7),
    completedPrev7: z.number().int().min(0).max(7),
    trackedPrev7: z.number().int().min(0).max(7),
});

const weeklyReportRequest = z.object({
    action: z.literal('weekly_report'),
    payload: z.object({
        categoryFilter: z.string().max(40),
        habits: z.array(weeklyHabitStat).max(50),
        bestWeekday: z.string().max(20).nullable(),
        worstWeekday: z.string().max(20).nullable(),
    }),
});

export const aiRequestSchema = z.discriminatedUnion('action', [
    breakdownRequest,
    naturalLogRequest,
    coachRequest,
    weeklyReportRequest,
]);

export type AIRequest = z.infer<typeof aiRequestSchema>;
export type CoachHabitStat = z.infer<typeof coachHabitStat>;
export type WeeklyReportPayload = z.infer<typeof weeklyReportRequest>['payload'];

// ---------- Model responses ----------

export const breakdownResponseSchema = z.object({
    habits: z
        .array(
            z.object({
                name,
                // Unknown categories fall back to General so they match the app's filters
                category: z.enum(HABIT_CATEGORIES).catch('General'),
            })
        )
        .min(1)
        .max(6),
});

export const naturalLogResponseSchema = z.object({
    matchedTaskIds: z.array(z.string()).max(100),
    explanation: z.string().max(500).optional(),
});

export const weeklyReportResponseSchema = z.object({
    topWin: z.string().trim().min(1).max(400),
    riskAlert: z.string().trim().min(1).max(400),
    customTip: z.string().trim().min(1).max(400),
});

export type WeeklyReportResponse = z.infer<typeof weeklyReportResponseSchema>;

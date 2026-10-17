import { describe, it, expect } from 'vitest';
import { aiRequestSchema, breakdownResponseSchema, naturalLogResponseSchema } from '@/lib/ai-schemas';

describe('AI request schema', () => {
    it('accepts a valid coach request', () => {
        const result = aiRequestSchema.safeParse({
            action: 'coach',
            payload: { habits: [{ name: 'Read', category: 'Personal', currentStreak: 3, doneToday: true, completedLast7: 5 }] },
        });
        expect(result.success).toBe(true);
    });

    it.each([
        ['unknown action', { action: 'hack', payload: {} }],
        ['oversized goal', { action: 'breakdown', payload: { goal: 'x'.repeat(301) } }],
        ['too many tasks', { action: 'natural_log', payload: { input: 'hi', tasks: Array.from({ length: 101 }, (_, i) => ({ id: `${i}`, name: 'x' })) } }],
        ['impossible weekly count', { action: 'coach', payload: { habits: [{ name: 'R', category: 'G', currentStreak: 1, doneToday: true, completedLast7: 8 }] } }],
        ['legacy payload shape', { action: 'coach', payload: { tasks: ['x'], completionStats: {} } }],
    ])('rejects %s', (_label, body) => {
        expect(aiRequestSchema.safeParse(body).success).toBe(false);
    });
});

describe('AI response schemas', () => {
    it('maps unknown breakdown categories to General', () => {
        const parsed = breakdownResponseSchema.parse({ habits: [{ name: 'Run 5k', category: 'Cardio' }, { name: 'Plan week', category: 'Work' }] });
        expect(parsed.habits.map((h) => h.category)).toEqual(['General', 'Work']);
    });

    it('rejects an empty habit list', () => {
        expect(breakdownResponseSchema.safeParse({ habits: [] }).success).toBe(false);
    });

    it('requires matchedTaskIds to be an array of strings', () => {
        expect(naturalLogResponseSchema.safeParse({ matchedTaskIds: 'abc' }).success).toBe(false);
        expect(naturalLogResponseSchema.safeParse({ matchedTaskIds: ['a'], explanation: 'ok' }).success).toBe(true);
    });
});

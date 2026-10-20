import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createFakeSupabase } from './helpers/fakeSupabase';

const holder = vi.hoisted(() => ({ client: null as unknown, pushResults: new Map<string, 'sent' | 'gone' | 'failed'>(), sent: [] as { endpoint: string; body: string }[] }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => holder.client }));
vi.mock('@/lib/push', () => ({
    pushConfigured: () => true,
    sendPush: async (sub: { endpoint: string }, payload: { body: string }) => {
        holder.sent.push({ endpoint: sub.endpoint, body: payload.body });
        return holder.pushResults.get(sub.endpoint) ?? 'sent';
    },
}));

import { GET } from '@/app/api/reminders/cron/route';

const ME = 'user-1';
const TODAY = '2026-10-14'; // Wednesday

function seed() {
    return {
        reminder_settings: [
            { user_id: ME, enabled: true, remind_at: '20:00:00', timezone: 'Asia/Kolkata', last_sent_on: null },
            { user_id: 'user-2', enabled: true, remind_at: '22:00:00', timezone: 'Asia/Kolkata', last_sent_on: null },
        ],
        tasks: [
            { id: 't1', user_id: ME, archived: false, schedule_mask: 127 },
            { id: 't2', user_id: ME, archived: false, schedule_mask: 127 },
            { id: 't3', user_id: ME, archived: false, schedule_mask: 0b1000001 }, // weekends: not due
        ],
        entries: [{ id: 'e1', task_id: 't1', user_id: ME, entry_date: TODAY, completed: true }],
        daily_tasks: [{ id: 'd1', user_id: ME, task_date: TODAY, completed: false, title: 'Call bank' }],
        push_subscriptions: [
            { endpoint: 'https://push.example/phone', user_id: ME, p256dh: 'k', auth: 'a' },
            { endpoint: 'https://push.example/old', user_id: ME, p256dh: 'k', auth: 'a' },
        ],
    };
}

const call = (auth?: string) => GET(new Request('http://localhost/api/reminders/cron', { headers: auth ? { authorization: auth } : {} }));

beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 'test-secret');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T14:45:00Z')); // 20:15 in India
    holder.sent = [];
    holder.pushResults = new Map([['https://push.example/old', 'gone']]);
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
});

describe('reminders cron', () => {
    it('rejects calls without the secret', async () => {
        holder.client = createFakeSupabase(seed()).client;
        expect((await call()).status).toBe(401);
        expect((await call('Bearer wrong')).status).toBe(401);
    });

    it("sends what's left to users whose local time has come, once a day", async () => {
        const db = seed();
        holder.client = createFakeSupabase(db).client;

        const res = await call('Bearer test-secret');
        expect(await res.json()).toEqual({ checked: 2, due: 1, sent: 1 });

        // t2 is due and open (t1 done, t3 not due today), plus one open daily task
        expect(holder.sent.map((s) => s.endpoint)).toEqual(['https://push.example/phone', 'https://push.example/old']);
        expect(holder.sent[0].body).toBe('You still have 1 habit and 1 task left today. Keep your streak going!');
        // Dead subscriptions are removed; the day is marked as sent
        expect(db.push_subscriptions.map((s) => s.endpoint)).toEqual(['https://push.example/phone']);
        expect(db.reminder_settings[0].last_sent_on).toBe(TODAY);
        expect(db.reminder_settings[1].last_sent_on).toBeNull();

        await call('Bearer test-secret');
        expect(holder.sent).toHaveLength(2);
    });
});

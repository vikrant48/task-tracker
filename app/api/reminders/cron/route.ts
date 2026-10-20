import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { pushConfigured, sendPush } from '@/lib/push';
import { isReminderDue, localClock, reminderMessage } from '@/lib/reminders';
import { isDueOn } from '@/lib/schedule';

// Sends each user's daily reminder at their chosen local time. Call it every 15 minutes from a scheduler
// (Supabase pg_cron, cron-job.org, ...) with `Authorization: Bearer <CRON_SECRET>`. See supabase/reminders_cron.sql.

function authorized(req: Request): boolean {
    const secret = process.env.CRON_SECRET;
    if (!secret) return false;
    const given = Buffer.from(req.headers.get('authorization') ?? '');
    const expected = Buffer.from(`Bearer ${secret}`);
    return given.length === expected.length && timingSafeEqual(given, expected);
}

async function run(req: Request) {
    if (!process.env.CRON_SECRET || !pushConfigured()) {
        console.error('Reminders are not configured: set CRON_SECRET and the VAPID keys');
        return NextResponse.json({ error: 'Reminders are not configured.' }, { status: 500 });
    }
    if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminClient();
    const now = new Date();

    const { data: settings, error } = await admin.from('reminder_settings').select('*').eq('enabled', true).limit(5000);
    if (error) {
        console.error('Error loading reminder settings:', error);
        return NextResponse.json({ error: 'Could not load reminder settings.' }, { status: 500 });
    }

    const due = (settings ?? []).filter((s) => isReminderDue(s, now));
    let sent = 0;

    for (const setting of due) {
        try {
            const { date } = localClock(now, setting.timezone);
            const [tasksRes, doneRes, openRes, subsRes] = await Promise.all([
                admin.from('tasks').select('id, schedule_mask').eq('user_id', setting.user_id).eq('archived', false),
                admin.from('entries').select('task_id').eq('user_id', setting.user_id).eq('entry_date', date).eq('completed', true),
                admin.from('daily_tasks').select('id', { count: 'exact', head: true }).eq('user_id', setting.user_id).eq('task_date', date).eq('completed', false),
                admin.from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', setting.user_id),
            ]);
            const failed = tasksRes.error ?? doneRes.error ?? openRes.error ?? subsRes.error;
            if (failed) throw failed;

            const done = new Set((doneRes.data ?? []).map((e) => e.task_id));
            const habitsLeft = (tasksRes.data ?? []).filter((t) => isDueOn(t.schedule_mask, date) && !done.has(t.id)).length;
            const message = reminderMessage(habitsLeft, openRes.count ?? 0);

            // Nothing to say, or nowhere to send it: done for today
            let delivered = !message || !subsRes.data?.length;
            if (message) {
                for (const sub of subsRes.data ?? []) {
                    const result = await sendPush(sub, { ...message, url: '/' });
                    if (result === 'sent') {
                        delivered = true;
                        sent += 1;
                    } else if (result === 'gone') {
                        await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
                    }
                }
            }

            // Once a day; if every send failed, the next run retries
            if (delivered) {
                await admin.from('reminder_settings').update({ last_sent_on: date }).eq('user_id', setting.user_id);
            }
        } catch (err) {
            console.error('Reminder failed for a user:', err);
        }
    }

    return NextResponse.json({ checked: settings?.length ?? 0, due: due.length, sent });
}

export const GET = run;
export const POST = run;

-- Calls the reminder sender every 15 minutes with pg_cron + pg_net (both available on Supabase's free plan).
-- 1. Replace the two placeholders below: your deployed app URL and the CRON_SECRET you set in Vercel.
-- 2. Run this in the Supabase SQL Editor. Re-running it replaces the job.
-- Never commit this file with the real secret filled in.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('focusflow-reminders')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'focusflow-reminders');

SELECT cron.schedule(
    'focusflow-reminders',
    '*/15 * * * *',
    $$
    SELECT net.http_get(
        url := 'https://YOUR-APP.vercel.app/api/reminders/cron',
        headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET')
    );
    $$
);

-- Check recent runs:
-- SELECT * FROM net._http_response ORDER BY created DESC LIMIT 5;

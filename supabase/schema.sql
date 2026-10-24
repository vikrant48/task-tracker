-- FocusFlow database schema.
--
-- One idempotent script: run it in the Supabase SQL Editor on a fresh project, or re-run it on an
-- existing database (including one set up with the older multi-file migrations) to bring it to the
-- current state. It is safe to run more than once.
--
-- Model:
--   tasks              habits; owned by user_id; schedule_mask = weekdays the habit is due
--   task_shares        a habit shared with another user, by email
--   entries            one check-in per person per habit per day (+ optional note)
--   daily_tasks        one-off to-dos for a single day (can be moved to the next day); may link a habit
--   push_subscriptions browser push endpoints for scheduled reminders
--   reminder_settings  each user's daily reminder time and timezone
-- Members of a habit (owner + people it is shared with) can see each other's check-ins,
-- but can only create or change their own. Only the owner can edit, share or reorder a habit.

BEGIN;

-- ---------------------------------------------------------------- tables

CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'General',
    sort_order INTEGER NOT NULL DEFAULT 0,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    entry_date DATE NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.task_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    shared_with_email TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (task_id, shared_with_email)
);

CREATE TABLE IF NOT EXISTS public.daily_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
    task_date DATE NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    -- Set when the task was moved here from an earlier day ("From yesterday")
    moved_from DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    endpoint TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.reminder_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    remind_at TIME NOT NULL DEFAULT '20:00',
    timezone TEXT NOT NULL DEFAULT 'UTC',
    -- Local date of the last reminder sent, so each user gets at most one per day
    last_sent_on DATE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Upgrade older databases: category was nullable, entries.user_id was nullable
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS category TEXT;
UPDATE public.tasks SET category = 'General' WHERE category IS NULL;
ALTER TABLE public.tasks ALTER COLUMN category SET DEFAULT 'General';
ALTER TABLE public.tasks ALTER COLUMN category SET NOT NULL;

UPDATE public.entries e SET user_id = t.user_id
FROM public.tasks t
WHERE e.user_id IS NULL AND t.id = e.task_id;
DELETE FROM public.entries WHERE user_id IS NULL;
ALTER TABLE public.entries ALTER COLUMN user_id SET NOT NULL;

-- Weekdays a habit is due: bit n = weekday n (0 = Sunday ... 6 = Saturday). 127 = every day.
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS schedule_mask SMALLINT NOT NULL DEFAULT 127
    CHECK (schedule_mask BETWEEN 1 AND 127);

-- A daily task added from a habit: completing the task checks the habit in for that day
ALTER TABLE public.daily_tasks ADD COLUMN IF NOT EXISTS habit_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL;

-- Optional note on a check-in
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS note TEXT CHECK (char_length(note) <= 500);

-- One check-in per person per habit per day (older databases had one per habit per day)
DO $$
DECLARE c RECORD;
BEGIN
    FOR c IN
        SELECT con.conname
        FROM pg_constraint con
        WHERE con.conrelid = 'public.entries'::regclass
          AND con.contype = 'u'
          AND con.conname <> 'entries_task_user_date_key'
    LOOP
        EXECUTE format('ALTER TABLE public.entries DROP CONSTRAINT %I', c.conname);
    END LOOP;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.entries'::regclass AND conname = 'entries_task_user_date_key'
    ) THEN
        ALTER TABLE public.entries ADD CONSTRAINT entries_task_user_date_key UNIQUE (task_id, user_id, entry_date);
    END IF;
END $$;

DROP INDEX IF EXISTS public.idx_tasks_sort_order;
DROP INDEX IF EXISTS public.idx_entries_task_id; -- covered by entries_task_user_date_key
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_entries_user_date ON public.entries(user_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_user_date ON public.daily_tasks(user_id, task_date);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_settings ENABLE ROW LEVEL SECURITY;

-- Live updates: stream check-in changes to the app. Full replica identity so deletes carry the old row.
ALTER TABLE public.entries REPLICA IDENTITY FULL;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
       AND NOT EXISTS (
           SELECT 1 FROM pg_publication_tables
           WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'entries'
       ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.entries;
    END IF;
END $$;

-- ---------------------------------------------------------------- reset policies & old functions

DO $$
DECLARE p RECORD;
BEGIN
    FOR p IN
        SELECT policyname, tablename FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('tasks', 'entries', 'task_shares', 'daily_tasks', 'push_subscriptions', 'reminder_settings')
    LOOP
        EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
    END LOOP;
END $$;

-- Superseded helpers from older versions (they accepted arbitrary user ids / leaked emails)
DROP FUNCTION IF EXISTS public.is_task_owner(UUID, UUID);
DROP FUNCTION IF EXISTS public.is_task_shared_with(UUID, TEXT);
DROP FUNCTION IF EXISTS public.user_email_exists(TEXT);

-- ---------------------------------------------------------------- functions

-- Membership checks about the CALLER only. SECURITY DEFINER avoids RLS recursion between tables.
CREATE OR REPLACE FUNCTION public.is_task_owner(p_task_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = p_task_id AND t.user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_task_shared_with_me(p_task_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.task_shares s
        WHERE s.task_id = p_task_id AND s.shared_with_email = lower(auth.jwt() ->> 'email')
    );
$$;

-- Share a habit with a registered user. Owner only.
-- Returns 'ok' | 'exists' | 'not_found' | 'self' | 'not_owner' | 'unauthenticated'
CREATE OR REPLACE FUNCTION public.share_task(p_task_id UUID, p_email TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_email TEXT := lower(trim(p_email));
BEGIN
    IF auth.uid() IS NULL THEN RETURN 'unauthenticated'; END IF;
    IF NOT public.is_task_owner(p_task_id) THEN RETURN 'not_owner'; END IF;
    IF v_email = lower(auth.jwt() ->> 'email') THEN RETURN 'self'; END IF;
    IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = v_email) THEN RETURN 'not_found'; END IF;

    INSERT INTO public.task_shares (task_id, shared_with_email) VALUES (p_task_id, v_email)
    ON CONFLICT (task_id, shared_with_email) DO NOTHING;
    IF NOT FOUND THEN RETURN 'exists'; END IF;
    RETURN 'ok';
END;
$$;

-- Schedules. A habit is due on weekday d when bit d of its mask is set (0 = Sunday, like EXTRACT(DOW)).
CREATE OR REPLACE FUNCTION public.schedule_has_day(p_mask INTEGER, p_day DATE)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
    SELECT (p_mask >> EXTRACT(DOW FROM p_day)::INTEGER) & 1 = 1;
$$;

-- Position of p_day in the sequence of due days (counted from Sunday 2000-01-02). Consecutive due
-- days get consecutive numbers, so streaks skip days the habit isn't scheduled instead of breaking.
-- For an every-day habit this is just the day count. On a day off it equals the previous due day.
CREATE OR REPLACE FUNCTION public.schedule_ordinal(p_mask INTEGER, p_day DATE)
RETURNS INTEGER LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
    SELECT ((p_day - DATE '2000-01-02') / 7) * length(replace(p_mask::BIT(7)::TEXT, '0', ''))
         + length(replace((p_mask & ((2 << ((p_day - DATE '2000-01-02') % 7)) - 1))::BIT(7)::TEXT, '0', ''));
$$;

-- Streaks over the caller's own check-ins on due days (gaps-and-islands over schedule_ordinal).
-- p_today comes from the client because "today" depends on the user's timezone.
CREATE OR REPLACE FUNCTION public.get_task_streak_stats(p_today DATE)
RETURNS TABLE (task_id UUID, current_streak INTEGER, longest_streak INTEGER, first_completed DATE)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
    WITH done AS (
        SELECT DISTINCT e.task_id, t.schedule_mask AS mask, e.entry_date,
               public.schedule_ordinal(t.schedule_mask, e.entry_date) AS ord
        FROM public.entries e
        JOIN public.tasks t ON t.id = e.task_id
        WHERE e.completed AND e.user_id = auth.uid() AND e.entry_date <= p_today
          AND public.schedule_has_day(t.schedule_mask, e.entry_date)
    ),
    runs AS (
        SELECT task_id, mask, MIN(entry_date) AS run_start, MAX(ord) AS run_end, COUNT(*)::INTEGER AS run_length
        FROM (SELECT d.*, d.ord - (ROW_NUMBER() OVER (PARTITION BY d.task_id ORDER BY d.ord))::INTEGER AS island FROM done d) islands
        GROUP BY task_id, mask, island
    )
    SELECT r.task_id,
           -- Current: the run reaches the latest due day, or the one before if today is due but not done yet
           COALESCE(MAX(r.run_length) FILTER (
               WHERE r.run_end >= public.schedule_ordinal(r.mask, p_today)
                                - CASE WHEN public.schedule_has_day(r.mask, p_today) THEN 1 ELSE 0 END
           ), 0)::INTEGER,
           MAX(r.run_length)::INTEGER,
           MIN(r.run_start)
    FROM runs r
    GROUP BY r.task_id;
$$;

-- Length of the caller's run ending on the last due day on or before p_anchor
-- (the tracker counts recent days itself and adds this on)
CREATE OR REPLACE FUNCTION public.get_streak_carry_in(p_anchor DATE)
RETURNS TABLE (task_id UUID, run_length INTEGER)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
    WITH done AS (
        SELECT DISTINCT e.task_id, t.schedule_mask AS mask, public.schedule_ordinal(t.schedule_mask, e.entry_date) AS ord
        FROM public.entries e
        JOIN public.tasks t ON t.id = e.task_id
        WHERE e.completed AND e.user_id = auth.uid() AND e.entry_date <= p_anchor
          AND public.schedule_has_day(t.schedule_mask, e.entry_date)
    )
    SELECT task_id, COUNT(*)::INTEGER
    FROM (SELECT d.*, d.ord - (ROW_NUMBER() OVER (PARTITION BY d.task_id ORDER BY d.ord))::INTEGER AS island FROM done d) islands
    GROUP BY task_id, mask, island
    HAVING MAX(ord) = public.schedule_ordinal(mask, p_anchor);
$$;

-- Save habit order in one request: array position becomes sort_order. Only the caller's habits change.
CREATE OR REPLACE FUNCTION public.reorder_tasks(p_task_ids UUID[])
RETURNS VOID LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
    UPDATE public.tasks t SET sort_order = o.position - 1
    FROM unnest(p_task_ids) WITH ORDINALITY AS o(id, position)
    WHERE t.id = o.id AND t.user_id = auth.uid();
$$;

-- Supabase grants EXECUTE to anon by default; only signed-in users may call these
REVOKE EXECUTE ON FUNCTION
    public.is_task_owner(UUID), public.is_task_shared_with_me(UUID), public.share_task(UUID, TEXT),
    public.get_task_streak_stats(DATE), public.get_streak_carry_in(DATE), public.reorder_tasks(UUID[]),
    public.schedule_has_day(INTEGER, DATE), public.schedule_ordinal(INTEGER, DATE)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
    public.is_task_owner(UUID), public.is_task_shared_with_me(UUID), public.share_task(UUID, TEXT),
    public.get_task_streak_stats(DATE), public.get_streak_carry_in(DATE), public.reorder_tasks(UUID[]),
    public.schedule_has_day(INTEGER, DATE), public.schedule_ordinal(INTEGER, DATE)
TO authenticated;

-- ---------------------------------------------------------------- policies

CREATE POLICY "Owners manage their tasks" ON public.tasks
    FOR ALL TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Members view shared tasks" ON public.tasks
    FOR SELECT TO authenticated
    USING (public.is_task_shared_with_me(id));

CREATE POLICY "Members view check-ins" ON public.entries
    FOR SELECT TO authenticated
    USING (public.is_task_owner(task_id) OR public.is_task_shared_with_me(task_id));

CREATE POLICY "Members add their own check-ins" ON public.entries
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid() AND (public.is_task_owner(task_id) OR public.is_task_shared_with_me(task_id)));

CREATE POLICY "Members update their own check-ins" ON public.entries
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid() AND (public.is_task_owner(task_id) OR public.is_task_shared_with_me(task_id)))
    WITH CHECK (user_id = auth.uid() AND (public.is_task_owner(task_id) OR public.is_task_shared_with_me(task_id)));

-- Deleting a habit still removes everyone's check-ins through ON DELETE CASCADE
CREATE POLICY "Users delete their own check-ins" ON public.entries
    FOR DELETE TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Owners manage shares" ON public.task_shares
    FOR ALL TO authenticated
    USING (public.is_task_owner(task_id)) WITH CHECK (public.is_task_owner(task_id));

CREATE POLICY "Recipients view their shares" ON public.task_shares
    FOR SELECT TO authenticated
    USING (shared_with_email = lower(auth.jwt() ->> 'email'));

CREATE POLICY "Users manage their daily tasks" ON public.daily_tasks
    FOR ALL TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Push subscriptions and reminder settings are written by the server (service role) after it has
-- checked the session; signed-in users may read and remove their own.
CREATE POLICY "Users view their push subscriptions" ON public.push_subscriptions
    FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users remove their push subscriptions" ON public.push_subscriptions
    FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users manage their reminder settings" ON public.reminder_settings
    FOR ALL TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

COMMIT;

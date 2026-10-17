-- FocusFlow database schema.
--
-- One idempotent script: run it in the Supabase SQL Editor on a fresh project, or re-run it on an
-- existing database (including one set up with the older multi-file migrations) to bring it to the
-- current state. It is safe to run more than once.
--
-- Model:
--   tasks        habits; owned by user_id
--   task_shares  a habit shared with another user, by email
--   entries      one check-in per person per habit per day
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

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_shares ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------- reset policies & old functions

DO $$
DECLARE p RECORD;
BEGIN
    FOR p IN
        SELECT policyname, tablename FROM pg_policies
        WHERE schemaname = 'public' AND tablename IN ('tasks', 'entries', 'task_shares')
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

-- Streaks over the caller's own check-ins (gaps-and-islands: consecutive dates share date - row_number).
-- p_today comes from the client because "today" depends on the user's timezone.
CREATE OR REPLACE FUNCTION public.get_task_streak_stats(p_today DATE)
RETURNS TABLE (task_id UUID, current_streak INTEGER, longest_streak INTEGER, first_completed DATE)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
    WITH done AS (
        SELECT DISTINCT e.task_id, e.entry_date FROM public.entries e
        WHERE e.completed AND e.user_id = auth.uid() AND e.entry_date <= p_today
    ),
    runs AS (
        SELECT task_id, MIN(entry_date) AS run_start, MAX(entry_date) AS run_end, COUNT(*)::INTEGER AS run_length
        FROM (
            SELECT d.task_id, d.entry_date,
                   d.entry_date - (ROW_NUMBER() OVER (PARTITION BY d.task_id ORDER BY d.entry_date))::INTEGER AS island
            FROM done d
        ) islands
        GROUP BY task_id, island
    )
    SELECT r.task_id,
           COALESCE(MAX(r.run_length) FILTER (WHERE r.run_end >= p_today - 1), 0)::INTEGER,
           MAX(r.run_length)::INTEGER,
           MIN(r.run_start)
    FROM runs r
    GROUP BY r.task_id;
$$;

-- Length of the caller's run that ends exactly on p_anchor (the tracker counts recent days itself)
CREATE OR REPLACE FUNCTION public.get_streak_carry_in(p_anchor DATE)
RETURNS TABLE (task_id UUID, run_length INTEGER)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
    WITH done AS (
        SELECT DISTINCT e.task_id, e.entry_date FROM public.entries e
        WHERE e.completed AND e.user_id = auth.uid() AND e.entry_date <= p_anchor
    )
    SELECT task_id, COUNT(*)::INTEGER
    FROM (
        SELECT d.task_id, d.entry_date,
               d.entry_date - (ROW_NUMBER() OVER (PARTITION BY d.task_id ORDER BY d.entry_date))::INTEGER AS island
        FROM done d
    ) islands
    GROUP BY task_id, island
    HAVING MAX(entry_date) = p_anchor;
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
    public.get_task_streak_stats(DATE), public.get_streak_carry_in(DATE), public.reorder_tasks(UUID[])
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
    public.is_task_owner(UUID), public.is_task_shared_with_me(UUID), public.share_task(UUID, TEXT),
    public.get_task_streak_stats(DATE), public.get_streak_carry_in(DATE), public.reorder_tasks(UUID[])
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

COMMIT;

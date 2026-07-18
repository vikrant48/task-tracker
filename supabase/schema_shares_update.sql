-- Database Migration: Tasks and Entries Sharing
-- Creates the task_shares table and configures RLS to support collaborations.
-- Breaks RLS policy recursion loops using Security Definer helper functions.

-- 1. CREATE TASK SHARES TABLE
CREATE TABLE IF NOT EXISTS public.task_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
    shared_with_email TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (task_id, shared_with_email)
);

-- Enable RLS
ALTER TABLE public.task_shares ENABLE ROW LEVEL SECURITY;

-- 2. CREATE SECURITY DEFINER HELPER FUNCTIONS to bypass RLS recursion loops
CREATE OR REPLACE FUNCTION public.is_task_owner(task_id UUID, user_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.tasks 
        WHERE id = task_id AND tasks.user_id = is_task_owner.user_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_task_shared_with(task_id UUID, user_email TEXT)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.task_shares 
        WHERE task_shares.task_id = is_task_shared_with.task_id 
          AND task_shares.shared_with_email = is_task_shared_with.user_email
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.user_email_exists(target_email TEXT)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, auth -- Include auth schema to read auth.users table
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM auth.users 
        WHERE email = lower(target_email)
    );
END;
$$;

-- 3. DROP EXISTING POLICIES FOR UPGRADES
DROP POLICY IF EXISTS "Users can fully manage their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can view tasks shared with them" ON public.tasks;
DROP POLICY IF EXISTS "Users can fully manage their own task entries" ON public.entries;
DROP POLICY IF EXISTS "Users can view or log their own and shared entries" ON public.entries;
DROP POLICY IF EXISTS "Users can manage shares for their own tasks" ON public.task_shares;
DROP POLICY IF EXISTS "Collaborators can view shares they are included in" ON public.task_shares;

-- 4. DEFINE UPDATED TASKS POLICIES
-- Creator has full access
CREATE POLICY "Users can fully manage their own tasks" ON public.tasks
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Collaborator can view shared tasks
CREATE POLICY "Users can view tasks shared with them" ON public.tasks
    FOR SELECT
    TO authenticated
    USING (
        public.is_task_shared_with(id, auth.jwt() ->> 'email')
    );

-- 5. DEFINE UPDATED ENTRIES POLICIES
CREATE POLICY "Users can view or log their own and shared entries" ON public.entries
    FOR ALL
    TO authenticated
    USING (
        auth.uid() = user_id
        OR public.is_task_owner(task_id, auth.uid())
        OR public.is_task_shared_with(task_id, auth.jwt() ->> 'email')
    )
    WITH CHECK (
        auth.uid() = user_id
        OR public.is_task_owner(task_id, auth.uid())
        OR public.is_task_shared_with(task_id, auth.jwt() ->> 'email')
    );

-- 6. DEFINE SHARES POLICIES
-- Creator manages shares
CREATE POLICY "Users can manage shares for their own tasks" ON public.task_shares
    FOR ALL
    TO authenticated
    USING (
        public.is_task_owner(task_id, auth.uid())
    )
    WITH CHECK (
        public.is_task_owner(task_id, auth.uid())
    );

-- Collaborators can view shares
CREATE POLICY "Collaborators can view shares they are included in" ON public.task_shares
    FOR SELECT
    TO authenticated
    USING (shared_with_email = auth.jwt() ->> 'email');

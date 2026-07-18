-- Database Migration: Tasks and Entries Sharing
-- Creates the task_shares table and configures RLS to support collaborations.

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

-- 2. DROP EXISTING POLICIES FOR UPGRADES
DROP POLICY IF EXISTS "Users can fully manage their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can view tasks shared with them" ON public.tasks;
DROP POLICY IF EXISTS "Users can fully manage their own task entries" ON public.entries;
DROP POLICY IF EXISTS "Users can view or log their own and shared entries" ON public.entries;
DROP POLICY IF EXISTS "Users can manage shares for their own tasks" ON public.task_shares;
DROP POLICY IF EXISTS "Collaborators can view shares they are included in" ON public.task_shares;

-- 3. DEFINE UPDATED TASKS POLICIES
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
        id IN (
            SELECT task_id 
            FROM public.task_shares 
            WHERE shared_with_email = auth.jwt() ->> 'email'
        )
    );

-- 4. DEFINE UPDATED ENTRIES POLICIES
-- Creator & Collaborators can read/insert/update/delete completion entries
CREATE POLICY "Users can view or log their own and shared entries" ON public.entries
    FOR ALL
    TO authenticated
    USING (
        auth.uid() = user_id
        OR task_id IN (
            SELECT id 
            FROM public.tasks 
            WHERE user_id = auth.uid()
            OR id IN (
                SELECT task_id 
                FROM public.task_shares 
                WHERE shared_with_email = auth.jwt() ->> 'email'
            )
        )
    )
    WITH CHECK (
        auth.uid() = user_id
        OR task_id IN (
            SELECT id 
            FROM public.tasks 
            WHERE user_id = auth.uid()
            OR id IN (
                SELECT task_id 
                FROM public.task_shares 
                WHERE shared_with_email = auth.jwt() ->> 'email'
            )
        )
    );

-- 5. DEFINE SHARES POLICIES
-- Creator manages shares
CREATE POLICY "Users can manage shares for their own tasks" ON public.task_shares
    FOR ALL
    TO authenticated
    USING (
        task_id IN (
            SELECT id 
            FROM public.tasks 
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        task_id IN (
            SELECT id 
            FROM public.tasks 
            WHERE user_id = auth.uid()
        )
    );

-- Collaborators can view shares
CREATE POLICY "Collaborators can view shares they are included in" ON public.task_shares
    FOR SELECT
    TO authenticated
    USING (shared_with_email = auth.jwt() ->> 'email');

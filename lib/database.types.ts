// Supabase database types, in the format produced by the Supabase CLI.
// Regenerate from the live schema after any change to supabase/schema.sql:
//   npx supabase gen types typescript --project-id <project-ref> > lib/database.types.ts
// (Hand-written to match supabase/schema.sql; the generated file is authoritative.)

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type TaskFkey<Name extends string> = {
    foreignKeyName: Name;
    columns: ['task_id'];
    isOneToOne: false;
    referencedRelation: 'tasks';
    referencedColumns: ['id'];
};

export type Database = {
    public: {
        Tables: {
            tasks: {
                Row: {
                    archived: boolean;
                    category: string;
                    created_at: string;
                    id: string;
                    name: string;
                    schedule_mask: number;
                    sort_order: number;
                    user_id: string | null;
                };
                Insert: {
                    archived?: boolean;
                    category?: string;
                    created_at?: string;
                    id?: string;
                    name: string;
                    schedule_mask?: number;
                    sort_order?: number;
                    user_id?: string | null;
                };
                Update: Partial<Database['public']['Tables']['tasks']['Row']>;
                Relationships: [];
            };
            entries: {
                Row: {
                    completed: boolean;
                    completed_at: string | null;
                    entry_date: string;
                    id: string;
                    note: string | null;
                    task_id: string;
                    user_id: string;
                };
                Insert: {
                    completed?: boolean;
                    completed_at?: string | null;
                    entry_date: string;
                    id?: string;
                    note?: string | null;
                    task_id: string;
                    user_id?: string;
                };
                Update: Partial<Database['public']['Tables']['entries']['Row']>;
                Relationships: [TaskFkey<'entries_task_id_fkey'>];
            };
            task_shares: {
                Row: {
                    created_at: string;
                    id: string;
                    shared_with_email: string;
                    task_id: string;
                };
                Insert: {
                    created_at?: string;
                    id?: string;
                    shared_with_email: string;
                    task_id: string;
                };
                Update: Partial<Database['public']['Tables']['task_shares']['Row']>;
                Relationships: [TaskFkey<'task_shares_task_id_fkey'>];
            };
            daily_tasks: {
                Row: {
                    completed: boolean;
                    completed_at: string | null;
                    created_at: string;
                    habit_id: string | null;
                    id: string;
                    moved_from: string | null;
                    task_date: string;
                    title: string;
                    user_id: string;
                };
                Insert: {
                    completed?: boolean;
                    completed_at?: string | null;
                    created_at?: string;
                    habit_id?: string | null;
                    id?: string;
                    moved_from?: string | null;
                    task_date: string;
                    title: string;
                    user_id?: string;
                };
                Update: Partial<Database['public']['Tables']['daily_tasks']['Row']>;
                Relationships: [];
            };
            push_subscriptions: {
                Row: {
                    auth: string;
                    created_at: string;
                    endpoint: string;
                    p256dh: string;
                    user_id: string;
                };
                Insert: {
                    auth: string;
                    created_at?: string;
                    endpoint: string;
                    p256dh: string;
                    user_id?: string;
                };
                Update: Partial<Database['public']['Tables']['push_subscriptions']['Row']>;
                Relationships: [];
            };
            reminder_settings: {
                Row: {
                    enabled: boolean;
                    last_sent_on: string | null;
                    remind_at: string;
                    timezone: string;
                    updated_at: string;
                    user_id: string;
                };
                Insert: {
                    enabled?: boolean;
                    last_sent_on?: string | null;
                    remind_at?: string;
                    timezone?: string;
                    updated_at?: string;
                    user_id?: string;
                };
                Update: Partial<Database['public']['Tables']['reminder_settings']['Row']>;
                Relationships: [];
            };
        };
        Views: { [_ in never]: never };
        Functions: {
            get_streak_carry_in: {
                Args: { p_anchor: string };
                Returns: { task_id: string; run_length: number }[];
            };
            get_task_streak_stats: {
                Args: { p_today: string };
                Returns: {
                    task_id: string;
                    current_streak: number;
                    longest_streak: number;
                    first_completed: string | null;
                }[];
            };
            is_task_owner: { Args: { p_task_id: string }; Returns: boolean };
            is_task_shared_with_me: { Args: { p_task_id: string }; Returns: boolean };
            reorder_tasks: { Args: { p_task_ids: string[] }; Returns: undefined };
            schedule_has_day: { Args: { p_mask: number; p_day: string }; Returns: boolean };
            schedule_ordinal: { Args: { p_mask: number; p_day: string }; Returns: number };
            share_task: { Args: { p_task_id: string; p_email: string }; Returns: string };
        };
        Enums: { [_ in never]: never };
        CompositeTypes: { [_ in never]: never };
    };
};

// Supabase database types, in the format produced by the Supabase CLI.
// Regenerate from the live schema after any migration:
//   npx supabase gen types typescript --project-id <project-ref> > lib/database.types.ts
// (Hand-written to match supabase/*.sql; the generated file is authoritative.)

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

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
                    sort_order: number;
                    user_id: string | null;
                };
                Insert: {
                    archived?: boolean;
                    category?: string;
                    created_at?: string;
                    id?: string;
                    name: string;
                    sort_order?: number;
                    user_id?: string | null;
                };
                Update: {
                    archived?: boolean;
                    category?: string;
                    created_at?: string;
                    id?: string;
                    name?: string;
                    sort_order?: number;
                    user_id?: string | null;
                };
                Relationships: [];
            };
            entries: {
                Row: {
                    completed: boolean;
                    completed_at: string | null;
                    entry_date: string;
                    id: string;
                    task_id: string;
                    user_id: string;
                };
                Insert: {
                    completed?: boolean;
                    completed_at?: string | null;
                    entry_date: string;
                    id?: string;
                    task_id: string;
                    user_id?: string;
                };
                Update: {
                    completed?: boolean;
                    completed_at?: string | null;
                    entry_date?: string;
                    id?: string;
                    task_id?: string;
                    user_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'entries_task_id_fkey';
                        columns: ['task_id'];
                        isOneToOne: false;
                        referencedRelation: 'tasks';
                        referencedColumns: ['id'];
                    },
                ];
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
                Update: {
                    created_at?: string;
                    id?: string;
                    shared_with_email?: string;
                    task_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'task_shares_task_id_fkey';
                        columns: ['task_id'];
                        isOneToOne: false;
                        referencedRelation: 'tasks';
                        referencedColumns: ['id'];
                    },
                ];
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
            is_task_owner: {
                Args: { p_task_id: string };
                Returns: boolean;
            };
            is_task_shared_with_me: {
                Args: { p_task_id: string };
                Returns: boolean;
            };
            reorder_tasks: {
                Args: { p_task_ids: string[] };
                Returns: undefined;
            };
            share_task: {
                Args: { p_task_id: string; p_email: string };
                Returns: string;
            };
        };
        Enums: { [_ in never]: never };
        CompositeTypes: { [_ in never]: never };
    };
};

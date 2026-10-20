import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

// Service-role client: bypasses RLS. Server only (route handlers); never import from client code.
export function createAdminClient() {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
    return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}

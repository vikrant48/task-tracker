import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

// The signed-in user for the current request. Wrapped in React `cache` so the dashboard layout and
// page share a single auth check per request instead of each calling Supabase.
export const getCurrentUser = cache(async () => {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    return user;
});

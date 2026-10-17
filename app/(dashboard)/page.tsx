import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/supabase/user';
import WeeklyTracker from '@/components/tracker/WeeklyTracker';

// Server Component: resolves the user on the server (shared with the layout's lookup via React cache),
// so the client starts loading habits immediately instead of first asking Supabase who is signed in.
// Habit data stays client-side because "this week" depends on the user's timezone.
export default async function TrackerPage() {
    const user = await getCurrentUser();
    if (!user) redirect('/login');

    return <WeeklyTracker userId={user.id} />;
}

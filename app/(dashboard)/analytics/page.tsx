import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/supabase/user';
import AnalyticsView from '@/components/analytics/AnalyticsView';

export default async function AnalyticsPage() {
    const user = await getCurrentUser();
    if (!user) redirect('/login');

    return <AnalyticsView userId={user.id} />;
}

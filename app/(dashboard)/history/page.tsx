import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/supabase/user';
import HistoryView from '@/components/history/HistoryView';

export default async function HistoryPage() {
    const user = await getCurrentUser();
    if (!user) redirect('/login');

    return <HistoryView userId={user.id} />;
}

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/supabase/user';
import DailyTasksView from '@/components/tasks/DailyTasksView';

export default async function TasksPage() {
    const user = await getCurrentUser();
    if (!user) redirect('/login');

    return <DailyTasksView userId={user.id} />;
}

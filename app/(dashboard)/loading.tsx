import LoadingState from '@/components/LoadingState';

// Shown while a dashboard page's server component resolves (e.g. when switching tabs)
export default function DashboardLoading() {
    return <LoadingState />;
}

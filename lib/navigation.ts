import { Calendar, BarChart2, History, ListChecks } from 'lucide-react';

// Main sections, shared by the desktop header (server component) and the phone bottom bar (client)
export const NAV_ITEMS = [
    { href: '/', label: 'Habits', icon: Calendar },
    { href: '/tasks', label: 'Tasks', icon: ListChecks },
    { href: '/history', label: 'History', icon: History },
    { href: '/analytics', label: 'Analytics', icon: BarChart2 },
];

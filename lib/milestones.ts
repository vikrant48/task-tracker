// Streak milestone badges, shared by the tracker, the badges dialog and Analytics
export const MILESTONES = [
    {
        days: 7,
        image: '/badge_7days.png',
        name: '7-Day Focus',
        tier: '🥉 Bronze',
        chip: 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-400',
        card: 'bg-amber-500/10 border-amber-500/30',
        text: 'text-amber-700 dark:text-amber-400',
    },
    {
        days: 30,
        image: '/badge_30days.png',
        name: '30-Day Master',
        tier: '🥈 Silver',
        chip: 'bg-slate-400/20 border-slate-400/40 text-slate-700 dark:text-slate-200',
        card: 'bg-slate-400/10 border-slate-400/30',
        text: 'text-slate-700 dark:text-slate-200',
    },
    {
        days: 100,
        image: '/badge_100days.png',
        name: '100-Day Legend',
        tier: '🏆 Gold',
        chip: 'bg-yellow-400/20 border-yellow-500/40 text-yellow-700 dark:text-yellow-400',
        card: 'bg-yellow-500/10 border-yellow-500/30',
        text: 'text-yellow-700 dark:text-yellow-400',
    },
] as const;

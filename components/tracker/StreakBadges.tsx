/* eslint-disable @next/next/no-img-element -- tiny static badge icons */
import { Flame } from 'lucide-react';
import { MILESTONES } from '@/lib/milestones';

export function StreakChip({ streak }: { streak: number }) {
    return (
        <span
            className="flex items-center gap-0.5 text-xs font-extrabold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
            title={`Current Active Streak: ${streak} day${streak > 1 ? 's' : ''}`}
        >
            <Flame className="w-3 h-3 text-amber-500 fill-amber-500" />
            {streak}d
        </span>
    );
}

// Streak count plus any milestone badges reached
export default function StreakBadges({ streak }: { streak: number }) {
    if (streak <= 0) return null;

    return (
        <div className="flex items-center gap-1 shrink-0 ml-auto sm:ml-0">
            <StreakChip streak={streak} />
            {MILESTONES.filter((m) => streak >= m.days).map((m) => (
                <span key={m.days} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-xs font-bold ${m.chip}`} title={`${m.tier}: ${m.name} milestone`}>
                    <img src={m.image} alt="" className="w-4 h-4 object-contain" />
                    <span>{m.days}d</span>
                </span>
            ))}
        </div>
    );
}

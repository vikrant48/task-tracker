'use client';

import { Check, Lock, Users } from 'lucide-react';

const STYLES = {
    card: {
        base: 'w-12 h-12 rounded-2xl shrink-0',
        future: 'bg-slate-100/50 dark:bg-slate-950/20 border-slate-200/50 dark:border-slate-800/40 text-slate-300 dark:text-slate-700 opacity-40 cursor-not-allowed',
        open: 'bg-slate-100 dark:bg-slate-950/60 hover:bg-slate-200 dark:hover:bg-slate-950 border-slate-200 dark:border-slate-800 text-transparent hover:text-slate-400 active:scale-90 cursor-pointer',
        lock: 'w-5 h-5 text-slate-400/50 dark:text-slate-600',
        check: 'w-6 h-6 stroke-[3px]',
    },
    grid: {
        base: 'w-11 h-11 sm:w-12 sm:h-12 rounded-xl',
        future: 'bg-slate-100/30 dark:bg-slate-950/20 border-slate-200/40 dark:border-slate-900/30 text-slate-300 dark:text-slate-700 opacity-30 cursor-not-allowed',
        open: 'bg-slate-100 dark:bg-slate-950/40 hover:bg-slate-200 dark:hover:bg-slate-950 border-slate-200 dark:border-slate-800 text-transparent hover:text-slate-400 dark:hover:text-slate-700 active:scale-90 cursor-pointer',
        lock: 'w-4 h-4 text-slate-400/40 dark:text-slate-700',
        check: 'w-5 h-5 stroke-[3px] transition-transform',
    },
    compact: {
        base: 'w-8 h-8 rounded-lg',
        future: 'bg-slate-100/30 dark:bg-slate-950/20 border-slate-200/40 dark:border-slate-900/30 text-slate-300 dark:text-slate-700 opacity-30 cursor-not-allowed',
        open: 'bg-slate-100 dark:bg-slate-950/40 hover:bg-slate-200 dark:hover:bg-slate-950 border-slate-200 dark:border-slate-800 text-transparent hover:text-slate-400 dark:hover:text-slate-700 active:scale-90 cursor-pointer',
        lock: 'w-3 h-3 text-slate-400/40 dark:text-slate-700',
        check: 'w-3.5 h-3.5 stroke-[3px]',
    },
};

const COMPLETED = 'bg-linear-to-tr from-violet-600 to-indigo-600 border-violet-500 text-white shadow-lg shadow-violet-500/25 ring-2 ring-violet-500/20 active:scale-90 cursor-pointer';

interface CheckInButtonProps {
    taskName: string;
    dateStr: string;
    completed: boolean;
    isFuture: boolean;
    variant: keyof typeof STYLES;
    onToggle: () => void;
    // Partners who completed this shared habit on this day (shown as a read-only badge)
    partnerCount?: number;
}

const partnerLabel = (count: number) => `${count} partner${count > 1 ? 's' : ''} completed this day`;

export default function CheckInButton({ taskName, dateStr, completed, isFuture, variant, onToggle, partnerCount = 0 }: CheckInButtonProps) {
    const style = STYLES[variant];

    return (
        <div className="relative inline-flex shrink-0">
            {partnerCount > 0 && <PartnerBadge count={partnerCount} />}
            <button
                onClick={() => !isFuture && onToggle()}
                aria-label={`${taskName}, ${dateStr}`}
                aria-pressed={completed}
                disabled={isFuture}
                type="button"
                className={`${style.base} flex items-center justify-center focus:outline-none transition-all border ${isFuture ? style.future : completed ? COMPLETED : style.open}`}
                title={isFuture ? 'Future dates cannot be filled' : undefined}
            >
                {isFuture ? <Lock className={style.lock} /> : <Check className={style.check} />}
            </button>
        </div>
    );
}

function PartnerBadge({ count }: { count: number }) {
    const label = partnerLabel(count);
    return (
        <span
            role="img"
            aria-label={label}
            title={label}
            className="absolute -top-1.5 -right-1.5 z-10 h-4 min-w-4 px-0.5 rounded-full bg-indigo-500 text-white text-[9px] font-extrabold flex items-center justify-center gap-px ring-2 ring-white dark:ring-slate-950 pointer-events-none"
        >
            <Users className="w-2.5 h-2.5" />
            {count > 1 && count}
        </span>
    );
}

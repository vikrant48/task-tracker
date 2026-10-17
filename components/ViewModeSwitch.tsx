'use client';

import type { MobileViewMode } from '@/lib/types';

interface ViewModeSwitchProps {
    value: MobileViewMode;
    onChange: (mode: MobileViewMode) => void;
    cardsLabel: string;
    gridLabel: string;
}

// Mobile-only toggle between the card view and the full grid
export default function ViewModeSwitch({ value, onChange, cardsLabel, gridLabel }: ViewModeSwitchProps) {
    const options: { mode: MobileViewMode; label: string }[] = [
        { mode: 'cards', label: cardsLabel },
        { mode: 'matrix', label: gridLabel },
    ];

    return (
        <div className="sm:hidden flex items-center justify-between bg-white dark:bg-slate-900/40 p-2.5 border border-slate-200 dark:border-slate-900 rounded-2xl backdrop-blur transition-all">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 pl-1">Mobile View:</span>
            <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl">
                {options.map(({ mode, label }) => (
                    <button
                        key={mode}
                        type="button"
                        onClick={() => onChange(mode)}
                        aria-pressed={value === mode}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${value === mode
                            ? 'bg-linear-to-r from-violet-600 to-indigo-600 text-white shadow-md'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                    >
                        {label}
                    </button>
                ))}
            </div>
        </div>
    );
}

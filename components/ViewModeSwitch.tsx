'use client';

import { LayoutList, Table2 } from 'lucide-react';
import type { MobileViewMode } from '@/lib/types';

interface ViewModeSwitchProps {
    value: MobileViewMode;
    onChange: (mode: MobileViewMode) => void;
    cardsLabel: string;
    gridLabel: string;
}

// Phone-only segmented control: card view vs full grid. Icon buttons, labelled for screen readers.
export default function ViewModeSwitch({ value, onChange, cardsLabel, gridLabel }: ViewModeSwitchProps) {
    const options = [
        { mode: 'cards' as const, label: cardsLabel, Icon: LayoutList },
        { mode: 'matrix' as const, label: gridLabel, Icon: Table2 },
    ];

    return (
        <div role="group" aria-label="View" className="sm:hidden shrink-0 flex p-1 gap-1 rounded-full bg-slate-200/70 dark:bg-slate-900">
            {options.map(({ mode, label, Icon }) => (
                <button
                    key={mode}
                    type="button"
                    onClick={() => onChange(mode)}
                    aria-pressed={value === mode}
                    aria-label={label}
                    title={label}
                    className={`w-10 h-8 flex items-center justify-center rounded-full transition-colors cursor-pointer ${value === mode
                        ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-white shadow-sm'
                        : 'text-slate-500 dark:text-slate-400'
                        }`}
                >
                    <Icon className="w-4 h-4" />
                </button>
            ))}
        </div>
    );
}

'use client';

import { EVERY_DAY, WEEKDAYS, WEEKDAYS_ONLY, WEEKENDS_ONLY, toggleDay } from '@/lib/schedule';

const PRESETS = [
    { label: 'Every day', mask: EVERY_DAY },
    { label: 'Weekdays', mask: WEEKDAYS_ONLY },
    { label: 'Weekends', mask: WEEKENDS_ONLY },
];

// Weekday picker: presets plus one toggle per day. At least one day always stays selected.
export default function ScheduleDays({ mask, onChange }: { mask: number; onChange: (mask: number) => void }) {
    return (
        <div className="flex flex-col gap-3">
            <div role="group" aria-label="Schedule presets" className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                    <button
                        key={p.label}
                        type="button"
                        onClick={() => onChange(p.mask)}
                        aria-pressed={mask === p.mask}
                        className={`h-9 px-3.5 rounded-full text-sm font-semibold border transition-colors cursor-pointer ${mask === p.mask
                            ? 'bg-violet-500/15 border-violet-500/40 text-violet-700 dark:text-violet-300'
                            : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>
            <div role="group" aria-label="Due days" className="grid grid-cols-7 gap-1.5">
                {WEEKDAYS.map((d) => {
                    const on = ((mask >> d.day) & 1) === 1;
                    const isLastDay = on && (mask & (mask - 1)) === 0;
                    return (
                        <button
                            key={d.day}
                            type="button"
                            onClick={() => !isLastDay && onChange(toggleDay(mask, d.day))}
                            aria-pressed={on}
                            aria-label={d.label}
                            title={isLastDay ? 'A habit needs at least one day' : d.label}
                            className={`h-11 rounded-xl text-sm font-bold transition-colors cursor-pointer ${on
                                ? 'bg-linear-to-tr from-violet-600 to-indigo-600 text-white shadow-sm'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                }`}
                        >
                            {d.short}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

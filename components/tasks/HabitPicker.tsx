'use client';

import { useId, useState, type KeyboardEvent } from 'react';
import { Repeat, Search } from 'lucide-react';
import type { Task } from '@/lib/types';
import { isDueOn } from '@/lib/schedule';

interface HabitPickerProps {
    habits: Task[];
    today: string;
    disabled?: boolean;
    onPick: (habit: Task) => void;
}

// Searchable dropdown of your habits; picking one adds it to today's tasks.
// Habits due today are listed first.
export default function HabitPicker({ habits, today, disabled, onPick }: HabitPickerProps) {
    const listId = useId();
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);

    const q = query.trim().toLowerCase();
    const matches = habits
        .filter((h) => !q || h.name.toLowerCase().includes(q) || (h.category ?? '').toLowerCase().includes(q))
        .sort((a, b) => Number(isDueOn(b.schedule_mask, today)) - Number(isDueOn(a.schedule_mask, today)));
    const activeIndex = Math.min(active, matches.length - 1);

    const pick = (habit: Task) => {
        onPick(habit);
        setQuery('');
        setOpen(false);
        setActive(0);
    };

    const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, matches.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
        } else if (e.key === 'Enter' && open && matches[activeIndex]) {
            e.preventDefault();
            pick(matches[activeIndex]);
        } else if (e.key === 'Escape') {
            setOpen(false);
        }
    };

    if (habits.length === 0) return null;

    return (
        <div className="relative">
            <div className="relative flex items-center">
                <Search className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                    type="text"
                    role="combobox"
                    aria-label="Add from your habits"
                    aria-expanded={open}
                    aria-controls={listId}
                    aria-autocomplete="list"
                    aria-activedescendant={open && matches[activeIndex] ? `${listId}-${matches[activeIndex].id}` : undefined}
                    value={query}
                    disabled={disabled}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setOpen(true);
                        setActive(0);
                    }}
                    onFocus={() => setOpen(true)}
                    onBlur={() => setOpen(false)}
                    onKeyDown={onKeyDown}
                    placeholder="Add from your habits…"
                    className="w-full min-w-0 h-11 bg-slate-50 dark:bg-slate-900/60 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl pl-10 pr-4 text-sm font-semibold text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-50"
                />
            </div>

            {open && (
                <ul
                    id={listId}
                    role="listbox"
                    aria-label="Habits"
                    className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl py-1"
                >
                    {matches.length === 0 ? (
                        <li className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                            {q ? 'No matching habits' : 'All your habits are already on today’s list'}
                        </li>
                    ) : (
                        matches.map((habit, i) => {
                            const due = isDueOn(habit.schedule_mask, today);
                            return (
                                <li
                                    key={habit.id}
                                    id={`${listId}-${habit.id}`}
                                    role="option"
                                    aria-selected={i === activeIndex}
                                    // Keep focus in the input so the blur doesn't close the list before the click lands
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => pick(habit)}
                                    onMouseEnter={() => setActive(i)}
                                    className={`flex items-center gap-3 px-3 min-h-12 cursor-pointer ${i === activeIndex ? 'bg-violet-500/10' : ''}`}
                                >
                                    <Repeat className="w-4 h-4 shrink-0 text-violet-500" />
                                    <span className="flex-1 min-w-0">
                                        <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{habit.name}</span>
                                        <span className="block text-xs text-slate-400">{habit.category || 'General'}</span>
                                    </span>
                                    {!due && <span className="shrink-0 text-xs font-semibold text-slate-400">Not due today</span>}
                                </li>
                            );
                        })
                    )}
                </ul>
            )}
        </div>
    );
}

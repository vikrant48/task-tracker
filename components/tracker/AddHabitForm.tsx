'use client';

import { useState, type FormEvent } from 'react';
import { Plus, X, Loader2 } from 'lucide-react';
import { HABIT_CATEGORIES } from '@/lib/categories';
import { EVERY_DAY, describeSchedule } from '@/lib/schedule';
import ScheduleDays from './ScheduleDays';

interface AddHabitFormProps {
    adding: boolean;
    // Resolves to whether the habit was saved
    onAdd: (name: string, category: string, scheduleMask: number) => Promise<boolean>;
}

// Collapsible "Add New Habit" form
export default function AddHabitForm({ adding, onAdd }: AddHabitFormProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [name, setName] = useState('');
    const [category, setCategory] = useState<string>('General');
    const [scheduleMask, setScheduleMask] = useState(EVERY_DAY);
    const [showSchedule, setShowSchedule] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        if (await onAdd(name.trim(), category, scheduleMask)) {
            setName('');
            setScheduleMask(EVERY_DAY);
            setShowSchedule(false);
            setIsOpen(false);
        }
    };

    if (!isOpen) {
        return (
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="flex items-center justify-center gap-2 bg-linear-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-base sm:text-sm h-12 px-5 rounded-2xl shadow-lg shadow-violet-500/20 active:scale-[0.98] transition-all cursor-pointer border border-violet-500/30 w-full sm:w-auto self-start mt-auto"
            >
                <Plus className="w-4 h-4" />
                <span>Add New Habit</span>
            </button>
        );
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-3 bg-white dark:bg-slate-900/60 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl backdrop-blur mt-auto transition-all duration-200 relative"
        >
            <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-wider select-none pointer-events-none">New Habit Entry</span>
                <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                    aria-label="Close form"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="flex gap-2 flex-wrap items-center" role="group" aria-label="Category">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-wider mr-1 select-none pointer-events-none">Category:</span>
                {HABIT_CATEGORIES.map((cat) => (
                    <button
                        key={cat}
                        type="button"
                        onClick={() => setCategory(cat)}
                        aria-pressed={category === cat}
                        className={`h-10 px-4 rounded-full text-sm font-semibold select-none cursor-pointer transition-all border ${category === cat
                            ? 'bg-linear-to-tr from-violet-600 to-indigo-600 border-violet-500 text-white shadow shadow-violet-600/30'
                            : 'bg-slate-100 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:border-slate-400 dark:hover:border-slate-700'
                            }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>
            <div className="flex flex-col gap-2">
                <button
                    type="button"
                    onClick={() => setShowSchedule((v) => !v)}
                    aria-expanded={showSchedule}
                    className="self-start flex items-center gap-2 h-10 text-sm cursor-pointer"
                >
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-wider">Repeat:</span>
                    <span className="font-semibold text-violet-600 dark:text-violet-400 underline decoration-dotted underline-offset-4">{describeSchedule(scheduleMask)}</span>
                </button>
                {showSchedule && <ScheduleDays mask={scheduleMask} onChange={setScheduleMask} />}
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={adding}
                    aria-label="New habit name"
                    placeholder="I want to work on..."
                    enterKeyHint="done"
                    className="flex-1 min-w-0 appearance-none bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 h-12 px-4 rounded-xl text-sm placeholder-slate-400 dark:placeholder-slate-500 text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                    autoFocus
                />
                <button
                    type="submit"
                    disabled={adding || !name.trim()}
                    className="flex items-center justify-center bg-linear-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-bold h-12 px-5 rounded-xl disabled:opacity-40 transition-all select-none duration-150 cursor-pointer whitespace-nowrap shrink-0"
                >
                    {adding ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <>
                            <Plus className="w-4 h-4 mr-1.5" />
                            Add Task
                        </>
                    )}
                </button>
            </div>
        </form>
    );
}

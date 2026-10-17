'use client';

import { Sparkles } from 'lucide-react';
import { ALL_CATEGORIES } from '@/lib/categories';

interface EmptyStateProps {
    categoryFilter: string;
    importing: boolean;
    onImportStarter: () => void;
}

// Shown only after habits loaded successfully and there are none (in the current filter)
export default function EmptyState({ categoryFilter, importing, onImportStarter }: EmptyStateProps) {
    const showingAll = categoryFilter === ALL_CATEGORIES;

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-5 animate-pulse">
                <Sparkles className="w-8 h-8 text-violet-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Your Routine Tracker is Ready!</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mt-2 leading-relaxed">
                {showingAll
                    ? 'Kickstart your routine by adding custom habits below, or fast-track by importing these recommended starter goals:'
                    : `No tasks created under "${categoryFilter}" category yet.`}
            </p>

            {showingAll && (
                <div className="mt-6 flex flex-col items-center gap-3">
                    <button
                        onClick={onImportStarter}
                        disabled={importing}
                        type="button"
                        className="px-5 py-2.5 rounded-xl bg-linear-to-tr from-violet-600 to-indigo-600 text-white font-bold text-xs shadow-md shadow-violet-600/25 hover:from-violet-500 hover:to-indigo-500 active:scale-95 transition-all cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Import Starter Habit Plan
                    </button>
                    <span className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                        Adds: Water, Exercise, Reading, Focus block
                    </span>
                </div>
            )}
        </div>
    );
}

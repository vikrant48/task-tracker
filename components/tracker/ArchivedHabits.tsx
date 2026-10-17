'use client';

import { useState } from 'react';
import { Archive, ChevronRight, Trash2 } from 'lucide-react';
import type { Task } from '@/lib/types';

interface ArchivedHabitsProps {
    tasks: Task[];
    userId: string;
    onRestore: (task: Task) => void;
    onDelete: (task: Task) => void;
}

// Collapsible list of archived habits with restore / permanent delete
export default function ArchivedHabits({ tasks, userId, onRestore, onDelete }: ArchivedHabitsProps) {
    const [expanded, setExpanded] = useState(false);

    if (tasks.length === 0) return null;

    return (
        <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-900 rounded-2xl p-3 sm:p-4">
            <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                aria-expanded={expanded}
            >
                <Archive className="w-4 h-4" />
                Archived habits ({tasks.length})
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`} />
            </button>

            {expanded && (
                <div className="flex flex-col gap-2 mt-3">
                    {tasks.map((task) => (
                        <div key={task.id} className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-xl">
                            <div className="min-w-0">
                                <span className="block truncate text-sm font-semibold text-slate-700 dark:text-slate-300">{task.name}</span>
                                <span className="text-[9px] text-slate-500 font-extrabold tracking-wider uppercase">{task.category || 'General'}</span>
                            </div>
                            {task.user_id === userId && (
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => onRestore(task)}
                                        className="px-2.5 py-1 rounded-lg text-xs font-bold text-violet-600 dark:text-violet-400 bg-violet-500/10 hover:bg-violet-500/20 transition-colors cursor-pointer"
                                    >
                                        Restore
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onDelete(task)}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                        title="Delete permanently"
                                        aria-label={`Delete ${task.name} permanently`}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

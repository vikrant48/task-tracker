'use client';

import { Archive, Trash2 } from 'lucide-react';
import type { Task } from '@/lib/types';

interface RemoveHabitDialogProps {
    task: Task;
    onCancel: () => void;
    onArchive: (task: Task) => void;
    onDelete: (task: Task) => void;
}

// Confirmation before removing a habit: archive (reversible) or delete permanently
export default function RemoveHabitDialog({ task, onCancel, onArchive, onDelete }: RemoveHabitDialogProps) {
    return (
        <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
        >
            <div role="alertdialog" aria-modal="true" aria-labelledby="remove-task-title" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl">
                <h3 id="remove-task-title" className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
                    <Trash2 className="w-4 h-4 text-rose-500" />
                    {task.archived ? 'Delete habit permanently?' : 'Remove this habit?'}
                </h3>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-2 break-words">{task.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                    {task.archived
                        ? 'This deletes the habit and its entire completion history for you and any collaborators. This cannot be undone.'
                        : 'Archive hides it from your tracker but keeps its history, and you can restore it any time. Delete removes the habit and its entire history permanently.'}
                </p>
                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 mt-5">
                    <button
                        type="button"
                        autoFocus
                        onClick={onCancel}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                    >
                        Cancel
                    </button>
                    {!task.archived && (
                        <button
                            type="button"
                            onClick={() => onArchive(task)}
                            className="px-4 py-2 rounded-xl bg-linear-to-tr from-violet-600 to-indigo-600 text-white font-bold text-xs shadow cursor-pointer flex items-center justify-center gap-1.5"
                        >
                            <Archive className="w-3.5 h-3.5" />
                            Archive
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => onDelete(task)}
                        className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow cursor-pointer"
                    >
                        Delete permanently
                    </button>
                </div>
            </div>
        </div>
    );
}

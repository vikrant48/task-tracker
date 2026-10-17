'use client';

import { Archive, Trash2 } from 'lucide-react';
import type { Task } from '@/lib/types';
import Sheet from '@/components/Sheet';

interface RemoveHabitDialogProps {
    task: Task;
    onCancel: () => void;
    onArchive: (task: Task) => void;
    onDelete: (task: Task) => void;
}

const BUTTON = 'w-full sm:w-auto h-12 sm:h-10 px-4 rounded-xl text-sm font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5';

// Confirmation before removing a habit: archive (reversible) or delete permanently
export default function RemoveHabitDialog({ task, onCancel, onArchive, onDelete }: RemoveHabitDialogProps) {
    return (
        <Sheet titleId="remove-task-title" role="alertdialog" onClose={onCancel}>
            <h3 id="remove-task-title" className="text-lg font-bold text-slate-950 dark:text-white flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-500" />
                {task.archived ? 'Delete habit permanently?' : 'Remove this habit?'}
            </h3>
            <p className="text-base font-semibold text-slate-700 dark:text-slate-200 mt-2 break-words">{task.name}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                {task.archived
                    ? 'This deletes the habit and its entire completion history for you and any collaborators. This cannot be undone.'
                    : 'Archive hides it from your tracker but keeps its history, and you can restore it any time. Delete removes the habit and its entire history permanently.'}
            </p>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 mt-6">
                <button type="button" autoFocus onClick={onCancel} className={`${BUTTON} text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700`}>
                    Cancel
                </button>
                {!task.archived && (
                    <button type="button" onClick={() => onArchive(task)} className={`${BUTTON} bg-linear-to-tr from-violet-600 to-indigo-600 text-white shadow`}>
                        <Archive className="w-4 h-4" />
                        Archive
                    </button>
                )}
                <button type="button" onClick={() => onDelete(task)} className={`${BUTTON} bg-rose-600 hover:bg-rose-500 text-white shadow`}>
                    Delete permanently
                </button>
            </div>
        </Sheet>
    );
}

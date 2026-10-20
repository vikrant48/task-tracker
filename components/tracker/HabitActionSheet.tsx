'use client';

import type { ReactNode } from 'react';
import { ArrowUp, ArrowDown, Pencil, Share2, Trash2, CalendarDays } from 'lucide-react';
import { describeSchedule } from '@/lib/schedule';
import type { Task } from '@/lib/types';
import Sheet from '@/components/Sheet';

interface HabitActionSheetProps {
    task: Task;
    canMoveUp: boolean;
    canMoveDown: boolean;
    onMove: (direction: -1 | 1) => void;
    onEdit: () => void;
    onShare: () => void;
    onSchedule: () => void;
    onRemove: () => void;
    onClose: () => void;
}

// Owner actions for a habit, as a thumb-friendly list (replaces a cramped row of icon buttons)
export default function HabitActionSheet({ task, canMoveUp, canMoveDown, onMove, onEdit, onShare, onSchedule, onRemove, onClose }: HabitActionSheetProps) {
    // Every action closes the sheet first
    const run = (action: () => void) => () => {
        onClose();
        action();
    };

    const actions: { label: string; ariaLabel?: string; icon: ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean }[] = [
        { label: 'Move up', ariaLabel: `Move ${task.name} up`, icon: <ArrowUp className="w-5 h-5" />, onClick: () => onMove(-1), disabled: !canMoveUp },
        { label: 'Move down', ariaLabel: `Move ${task.name} down`, icon: <ArrowDown className="w-5 h-5" />, onClick: () => onMove(1), disabled: !canMoveDown },
        { label: 'Rename', icon: <Pencil className="w-5 h-5" />, onClick: run(onEdit) },
        { label: `Schedule · ${describeSchedule(task.schedule_mask)}`, ariaLabel: `Schedule for ${task.name}`, icon: <CalendarDays className="w-5 h-5" />, onClick: run(onSchedule) },
        { label: 'Share', icon: <Share2 className="w-5 h-5" />, onClick: run(onShare) },
        { label: 'Archive or delete', icon: <Trash2 className="w-5 h-5" />, onClick: run(onRemove), danger: true },
    ];

    return (
        <Sheet titleId="habit-actions-title" onClose={onClose}>
            <h3 id="habit-actions-title" className="text-base font-bold text-slate-900 dark:text-white truncate px-1 mb-2">
                {task.name}
            </h3>
            <ul className="flex flex-col">
                {actions.map((a) => (
                    <li key={a.label}>
                        <button
                            type="button"
                            onClick={a.onClick}
                            disabled={a.disabled}
                            aria-label={a.ariaLabel}
                            className={`w-full h-13 px-3 flex items-center gap-4 rounded-xl text-base font-semibold transition-colors disabled:opacity-35 disabled:cursor-not-allowed active:bg-slate-100 dark:active:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer ${a.danger ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-200'}`}
                        >
                            {a.icon}
                            {a.label}
                        </button>
                    </li>
                ))}
            </ul>
        </Sheet>
    );
}

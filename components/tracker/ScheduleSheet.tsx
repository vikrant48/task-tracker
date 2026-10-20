'use client';

import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import Sheet from '@/components/Sheet';
import ScheduleDays from './ScheduleDays';
import { describeSchedule } from '@/lib/schedule';
import type { Task } from '@/lib/types';

interface ScheduleSheetProps {
    task: Task;
    onSave: (mask: number) => void;
    onClose: () => void;
}

// Pick which weekdays a habit is due. Days off are skipped by streaks and stats.
export default function ScheduleSheet({ task, onSave, onClose }: ScheduleSheetProps) {
    const [mask, setMask] = useState(task.schedule_mask);

    return (
        <Sheet titleId="schedule-title" onClose={onClose}>
            <h3 id="schedule-title" className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-violet-500" />
                Schedule
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 truncate">{task.name}</p>

            <div className="mt-5">
                <ScheduleDays mask={mask} onChange={setMask} />
            </div>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                Due: <span className="font-semibold text-slate-700 dark:text-slate-200">{describeSchedule(mask)}</span>. Days off don&apos;t break your streak.
            </p>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 mt-6">
                <button type="button" onClick={onClose} className="h-12 sm:h-10 px-4 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 cursor-pointer">
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={() => {
                        onSave(mask);
                        onClose();
                    }}
                    disabled={mask === task.schedule_mask}
                    className="h-12 sm:h-10 px-5 rounded-xl text-sm font-bold text-white bg-linear-to-tr from-violet-600 to-indigo-600 disabled:opacity-40 cursor-pointer"
                >
                    Save schedule
                </button>
            </div>
        </Sheet>
    );
}

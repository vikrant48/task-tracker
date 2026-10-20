'use client';

import { useState } from 'react';
import { format, isToday } from 'date-fns';
import { Check, X, Users, MoreVertical, StickyNote } from 'lucide-react';
import type { Task } from '@/lib/types';
import { toDateStr } from '@/lib/dates';
import { isDueOn } from '@/lib/schedule';
import CheckInButton from './CheckInButton';
import HabitActionSheet from './HabitActionSheet';
import { StreakChip } from './StreakBadges';
import type { TaskRowProps } from './types';

interface MobileDayViewProps extends TaskRowProps {
    weekDays: Date[];
    className?: string;
    // Touch-friendly reordering of your own habits
    onMove: (taskId: string, direction: -1 | 1) => void;
}

// "Cards" view (default on phones): a day strip with progress, then one card per habit for the selected day.
// Render with a key per week so the selected day resets when the week changes.
export default function MobileDayView({
    weekDays,
    className = '',
    tasks,
    userId,
    todayStr,
    isCompleted,
    partnerCount,
    isShared,
    getStreak,
    editing,
    onToggle,
    onShare,
    onRemove,
    onSchedule,
    noteOf,
    onNote,
    onMove,
}: MobileDayViewProps) {
    const [selectedDayIndex, setSelectedDayIndex] = useState(() => Math.max(0, weekDays.findIndex((d) => isToday(d))));
    const [menuTask, setMenuTask] = useState<Task | null>(null);

    // Per day, only habits due that day count toward progress
    const dueOn = (dateStr: string) => tasks.filter((t) => isDueOn(t.schedule_mask, dateStr));
    const completedOn = (dateStr: string) => dueOn(dateStr).filter((t) => isCompleted(t.id, dateStr)).length;

    const selectedDay = weekDays[selectedDayIndex] ?? weekDays[0];
    const selectedDateStr = toDateStr(selectedDay);
    const selectedCompleted = completedOn(selectedDateStr);
    const selectedDue = dueOn(selectedDateStr).length;
    const pct = selectedDue > 0 ? Math.round((selectedCompleted / selectedDue) * 100) : 0;
    const isFuture = selectedDateStr > todayStr;
    // Only your own habits can be moved, so up/down skip over habits shared with you
    const ownedIds = tasks.filter((t) => t.user_id === userId).map((t) => t.id);
    const menuIndex = menuTask ? ownedIds.indexOf(menuTask.id) : -1;

    return (
        <div className={`flex flex-col gap-3 ${className}`}>
            {/* Day strip & progress */}
            <section aria-label="Choose a day" className="bg-white dark:bg-slate-900/40 p-3 border border-slate-200 dark:border-slate-900 rounded-2xl">
                <div className="grid grid-cols-7 gap-1">
                    {weekDays.map((day, idx) => {
                        const isSelected = idx === selectedDayIndex;
                        const isDayToday = isToday(day);
                        const dayCompleted = completedOn(toDateStr(day));
                        const dueCount = dueOn(toDateStr(day)).length;
                        const allDone = dueCount > 0 && dayCompleted === dueCount;

                        return (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => setSelectedDayIndex(idx)}
                                aria-pressed={isSelected}
                                aria-label={format(day, 'EEEE, MMMM d')}
                                className={`flex flex-col items-center gap-0.5 py-2 rounded-xl transition-colors ${isSelected
                                    ? 'bg-linear-to-tr from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/30'
                                    : isDayToday
                                        ? 'text-violet-600 dark:text-violet-300 ring-2 ring-inset ring-violet-500/60'
                                        : 'text-slate-600 dark:text-slate-400 active:bg-slate-100 dark:active:bg-slate-800'
                                    }`}
                            >
                                <span className="text-[11px] font-bold uppercase opacity-80">{format(day, 'eeeee')}</span>
                                <span className="text-base font-extrabold leading-none">{format(day, 'd')}</span>
                                {/* All done / some done / none */}
                                <span className={`mt-1 w-1.5 h-1.5 rounded-full ${allDone ? 'bg-emerald-400' : dayCompleted > 0 ? 'bg-amber-400' : isSelected ? 'bg-white/40' : 'bg-slate-300 dark:bg-slate-700'}`} />
                            </button>
                        );
                    })}
                </div>

                <div className="mt-3 flex justify-between items-baseline text-sm">
                    <span className="font-bold text-slate-800 dark:text-slate-100">
                        {isToday(selectedDay) ? 'Today' : format(selectedDay, 'EEEE, MMM d')}
                    </span>
                    <span className="font-bold text-violet-600 dark:text-violet-400">
                        {selectedCompleted} of {selectedDue} done
                    </span>
                </div>
                <div className="mt-2 w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Completed today">
                    <div className="h-full bg-linear-to-r from-violet-600 via-indigo-600 to-emerald-500 transition-all duration-300 rounded-full" style={{ width: `${pct}%` }} />
                </div>
            </section>

            {/* One card per habit for the selected day */}
            {tasks.map((task) => {
                const completed = isCompleted(task.id, selectedDateStr);
                const streak = getStreak(task.id);
                const partners = partnerCount(task.id, selectedDateStr);
                const note = noteOf(task.id, selectedDateStr);

                return (
                    <div
                        key={task.id}
                        className={`pl-3 pr-1 py-3 rounded-2xl border transition-colors flex items-center gap-3 ${completed
                            ? 'bg-violet-500/10 border-violet-500/30 dark:border-violet-500/20'
                            : 'bg-white dark:bg-slate-900/40 border-slate-200 dark:border-slate-900 shadow-sm'
                            }`}
                    >
                        <CheckInButton
                            variant="card"
                            taskName={task.name}
                            dateStr={selectedDateStr}
                            completed={completed}
                            isFuture={isFuture}
                            rest={!completed && !isDueOn(task.schedule_mask, selectedDateStr)}
                            partnerCount={partners}
                            onToggle={() => onToggle(task.id, selectedDateStr, completed)}
                        />

                        <div className="flex flex-col min-w-0 flex-1">
                            {editing.taskId === task.id ? (
                                <div className="flex items-center gap-1">
                                    <input
                                        type="text"
                                        aria-label="Habit name"
                                        value={editing.name}
                                        onChange={(e) => editing.setName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') editing.save(task.id);
                                            if (e.key === 'Escape') editing.cancel();
                                        }}
                                        enterKeyHint="done"
                                        className="h-11 min-w-0 flex-1 bg-slate-100 dark:bg-slate-950 border border-violet-500 px-3 rounded-xl font-semibold text-slate-900 dark:text-white focus:outline-none"
                                        autoFocus
                                    />
                                    <button onClick={() => editing.save(task.id)} type="button" aria-label="Save name" className="w-11 h-11 flex items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                                        <Check className="w-5 h-5 stroke-[3px]" />
                                    </button>
                                    <button onClick={editing.cancel} type="button" aria-label="Cancel rename" className="w-11 h-11 flex items-center justify-center rounded-xl text-slate-500 shrink-0">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <span className={`text-base font-bold truncate ${completed ? 'text-slate-500 dark:text-slate-400 line-through decoration-2 decoration-violet-500/50' : 'text-slate-800 dark:text-white'}`}>
                                            {task.name}
                                        </span>
                                        {isShared(task) && <Users className="w-4 h-4 text-indigo-500 shrink-0" aria-label="Shared habit" />}
                                    </div>

                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        <span className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                            {task.category || 'General'}
                                        </span>
                                        {streak > 0 && <StreakChip streak={streak} />}
                                        {partners > 0 && (
                                            <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                                                <Users className="w-3 h-3" />
                                                {partners} partner{partners > 1 ? 's' : ''} done
                                            </span>
                                        )}
                                    </div>
                                    {note && (
                                        <button
                                            type="button"
                                            onClick={() => onNote(task, selectedDateStr)}
                                            className="mt-1.5 text-left text-sm text-slate-600 dark:text-slate-300 line-clamp-2 italic cursor-pointer"
                                        >
                                            {note}
                                        </button>
                                    )}
                                </>
                            )}
                        </div>

                        {editing.taskId !== task.id && !isFuture && (
                            <button
                                onClick={() => onNote(task, selectedDateStr)}
                                type="button"
                                className={`w-11 h-11 shrink-0 flex items-center justify-center rounded-xl active:bg-slate-100 dark:active:bg-slate-800 cursor-pointer ${note ? 'text-amber-500' : 'text-slate-400'}`}
                                aria-label={`${note ? 'Edit' : 'Add'} note for ${task.name}`}
                            >
                                <StickyNote className="w-5 h-5" />
                            </button>
                        )}

                        {task.user_id === userId && editing.taskId !== task.id && (
                            <button
                                onClick={() => setMenuTask(task)}
                                type="button"
                                className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl text-slate-400 active:bg-slate-100 dark:active:bg-slate-800 cursor-pointer"
                                title="Habit Options"
                                aria-label={`Options for ${task.name}`}
                            >
                                <MoreVertical className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                );
            })}

            {menuTask && (
                <HabitActionSheet
                    task={menuTask}
                    canMoveUp={menuIndex > 0}
                    canMoveDown={menuIndex !== -1 && menuIndex < ownedIds.length - 1}
                    onMove={(direction) => onMove(menuTask.id, direction)}
                    onEdit={() => editing.start(menuTask)}
                    onShare={() => onShare(menuTask.id)}
                    onRemove={() => onRemove(menuTask)}
                    onSchedule={() => onSchedule(menuTask)}
                    onClose={() => setMenuTask(null)}
                />
            )}
        </div>
    );
}

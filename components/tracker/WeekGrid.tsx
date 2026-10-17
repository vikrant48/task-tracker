'use client';

import { format, isToday } from 'date-fns';
import { Check, X, GripVertical, Share2, Users, Trash2, Pencil } from 'lucide-react';
import { toDateStr } from '@/lib/dates';
import CheckInButton from './CheckInButton';
import StreakBadges from './StreakBadges';
import type { TaskRowProps } from './types';

interface WeekGridProps extends TaskRowProps {
    weekDays: Date[];
    draggedTaskId: string | null;
    onDragStart: (taskId: string) => void;
    onDragOver: (targetTaskId: string) => void;
    onDragEnd: () => void;
}

const ACTION_BUTTON = 'p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-400 transition-colors cursor-pointer flex items-center justify-center';

// Desktop/tablet week grid: one row per habit, one check-in cell per day, drag to reorder
export default function WeekGrid({
    weekDays,
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
    draggedTaskId,
    onDragStart,
    onDragOver,
    onDragEnd,
}: WeekGridProps) {
    return (
        <div className="overflow-x-auto relative w-full flex-1 touch-pan-y">
            <table className="w-full border-collapse text-left min-w-[750px]">
                <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-900 transition-colors">
                        <th className="sticky left-0 bg-slate-50 dark:bg-slate-950/80 z-20 px-6 py-4 font-bold text-xs sm:text-sm text-slate-500 dark:text-slate-400 w-[260px] border-r border-slate-200 dark:border-slate-900 backdrop-blur-md shadow-sm">
                            Routine Task & Collaborators
                        </th>
                        {weekDays.map((day) => {
                            const isDayToday = isToday(day);
                            return (
                                <th
                                    key={toDateStr(day)}
                                    className={`px-4 py-4 text-center font-extrabold text-xs border-r border-slate-200/60 dark:border-slate-900/50 last:border-r-0 ${isDayToday ? 'text-violet-500 dark:text-violet-400' : 'text-slate-500 dark:text-slate-400'}`}
                                >
                                    <div className="flex flex-col items-center">
                                        <span className="uppercase text-[9px] tracking-wider mb-0.5">{format(day, 'eee')}</span>
                                        <span className={`w-7 h-7 flex items-center justify-center rounded-full font-bold text-xs sm:text-sm tracking-tight ${isDayToday ? 'bg-violet-600/10 dark:bg-violet-600/20 text-violet-600 dark:text-violet-400 ring-2 ring-violet-500/20' : ''}`}>
                                            {format(day, 'd')}
                                        </span>
                                    </div>
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-900/50">
                    {tasks.map((task) => {
                        // Only your own habits can be reordered; shared-with-you habits keep the owner's order
                        const owned = task.user_id === userId;
                        return (
                            <tr
                                key={task.id}
                                draggable={owned}
                                onDragStart={(e) => {
                                    e.dataTransfer.effectAllowed = 'move';
                                    onDragStart(task.id);
                                }}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    onDragOver(task.id);
                                }}
                                onDragEnd={onDragEnd}
                                className="hover:bg-slate-100/40 dark:hover:bg-slate-900/20 select-none relative group transition-all duration-150"
                                style={{ opacity: draggedTaskId === task.id ? 0.4 : 1 }}
                            >
                                {/* Sticky habit cell */}
                                <td className="sticky left-0 bg-white dark:bg-slate-950 z-10 px-4 py-3 border-r border-slate-200 dark:border-slate-900 w-[260px] shadow-sm transition-colors duration-200">
                                    <div className="flex items-center gap-1.5">
                                        <div
                                            className={`p-1 ${owned ? 'text-slate-300 dark:text-slate-600 hover:text-slate-500 cursor-grab active:cursor-grabbing' : 'invisible'}`}
                                            aria-hidden="true"
                                        >
                                            <GripVertical className="w-3.5 h-3.5" />
                                        </div>

                                        <div className="flex-1 min-w-0 pr-1 group">
                                            {editing.taskId === task.id ? (
                                                <form
                                                    onSubmit={(e) => {
                                                        e.preventDefault();
                                                        editing.save(task.id);
                                                    }}
                                                    className="flex items-center gap-1 w-full"
                                                >
                                                    <input
                                                        type="text"
                                                        aria-label="Habit name"
                                                        value={editing.name}
                                                        onChange={(e) => editing.setName(e.target.value)}
                                                        autoFocus
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Escape') editing.cancel();
                                                        }}
                                                        className="bg-slate-50 dark:bg-slate-900 border border-violet-500 px-2 py-0.5 rounded text-xs text-slate-800 dark:text-slate-100 w-full focus:outline-none focus:ring-1 focus:ring-violet-500"
                                                    />
                                                    <button type="submit" className="p-1 text-emerald-500 hover:text-emerald-600 transition-colors cursor-pointer flex items-center justify-center" title="Save name">
                                                        <Check className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button type="button" onClick={editing.cancel} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer flex items-center justify-center" title="Cancel">
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </form>
                                            ) : (
                                                <>
                                                    <div className="flex items-center gap-1.5 w-full">
                                                        <span className="truncate text-slate-800 dark:text-slate-100 text-sm font-semibold leading-tight">{task.name}</span>
                                                        {isShared(task) && (
                                                            <span className="shrink-0" title="Collaborative Shared Habit">
                                                                <Users className="w-3.5 h-3.5 text-indigo-500" />
                                                            </span>
                                                        )}
                                                        <StreakBadges streak={getStreak(task.id)} />
                                                    </div>

                                                    <div className="flex items-center justify-between mt-1">
                                                        <span className="text-[9px] text-slate-500 font-extrabold tracking-wider uppercase">
                                                            {task.category || 'General'}
                                                        </span>

                                                        {/* Edit, share and remove: owner only */}
                                                        {task.user_id === userId && (
                                                            <div className="flex items-center gap-1">
                                                                <button onClick={() => editing.start(task)} type="button" className={`${ACTION_BUTTON} hover:text-violet-500`} title="Edit habit name">
                                                                    <Pencil className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button onClick={() => onShare(task.id)} type="button" className={`${ACTION_BUTTON} hover:text-indigo-500`} title="Share habit with partner">
                                                                    <Share2 className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button onClick={() => onRemove(task)} type="button" className={`${ACTION_BUTTON} hover:text-rose-500`} title="Archive or delete habit">
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </td>

                                {/* One check-in per day */}
                                {weekDays.map((day) => {
                                    const dateStr = toDateStr(day);
                                    const completed = isCompleted(task.id, dateStr);
                                    return (
                                        <td key={dateStr} className="px-2 py-2 text-center border-r border-slate-100 dark:border-slate-900/30 last:border-r-0">
                                            <div className="flex justify-center items-center">
                                                <CheckInButton
                                                    variant="grid"
                                                    taskName={task.name}
                                                    dateStr={dateStr}
                                                    completed={completed}
                                                    isFuture={dateStr > todayStr}
                                                    partnerCount={partnerCount(task.id, dateStr)}
                                                    onToggle={() => onToggle(task.id, dateStr, completed)}
                                                />
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

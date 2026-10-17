'use client';

import { useState } from 'react';
import { format, isToday } from 'date-fns';
import { Calendar as CalendarIcon, Check, X, Users, Pencil, Share2, Trash2, MoreVertical, ArrowUp, ArrowDown } from 'lucide-react';
import { toDateStr } from '@/lib/dates';
import CheckInButton from './CheckInButton';
import { StreakChip } from './StreakBadges';
import type { TaskRowProps } from './types';

interface MobileDayViewProps extends TaskRowProps {
    weekDays: Date[];
    // Touch-friendly reordering of your own habits
    onMove: (taskId: string, direction: -1 | 1) => void;
}

const MENU_BUTTON = 'p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed';

// Mobile "Daily Cards" view: a day strip with progress, then one card per habit for the selected day.
// Render with a key per week so the selected day resets when the week changes.
export default function MobileDayView({
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
    onMove,
}: MobileDayViewProps) {
    const [selectedDayIndex, setSelectedDayIndex] = useState(() => Math.max(0, weekDays.findIndex((d) => isToday(d))));
    const [activeMenuTaskId, setActiveMenuTaskId] = useState<string | null>(null);

    const completedOn = (dateStr: string) => tasks.filter((t) => isCompleted(t.id, dateStr)).length;

    const selectedDay = weekDays[selectedDayIndex] ?? weekDays[0];
    const selectedDateStr = toDateStr(selectedDay);
    const selectedCompleted = completedOn(selectedDateStr);
    const pct = tasks.length > 0 ? Math.round((selectedCompleted / tasks.length) * 100) : 0;
    const isFuture = selectedDateStr > todayStr;
    // Only your own habits can be moved, so up/down skip over habits shared with you
    const ownedIds = tasks.filter((t) => t.user_id === userId).map((t) => t.id);

    return (
        <>
            {/* Day strip selector & progress */}
            <div className="sm:hidden flex flex-col gap-3 bg-white dark:bg-slate-900/40 p-3.5 border border-slate-200 dark:border-slate-900 rounded-2xl backdrop-blur">
                <div className="grid grid-cols-7 gap-1">
                    {weekDays.map((day, idx) => {
                        const isSelected = idx === selectedDayIndex;
                        const isDayToday = isToday(day);
                        const dayCompleted = completedOn(toDateStr(day));
                        const isAllCompleted = tasks.length > 0 && dayCompleted === tasks.length;

                        return (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => setSelectedDayIndex(idx)}
                                aria-pressed={isSelected}
                                className={`flex flex-col items-center py-2 px-1 rounded-xl transition-all relative ${isSelected
                                    ? isDayToday
                                        ? 'bg-linear-to-tr from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/30 ring-2 ring-emerald-400 font-bold scale-[1.05] border-2 border-emerald-400'
                                        : 'bg-linear-to-tr from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/30 ring-2 ring-violet-500/20 font-bold scale-[1.05]'
                                    : isDayToday
                                        ? 'bg-emerald-500/20 dark:bg-emerald-500/25 border-2 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-extrabold shadow-sm'
                                        : 'bg-slate-100/70 dark:bg-slate-950/50 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-900'
                                    }`}
                            >
                                <span className={`text-[9px] uppercase tracking-wider font-extrabold opacity-80 mb-0.5 ${isDayToday && !isSelected ? 'text-emerald-600 dark:text-emerald-300' : ''}`}>
                                    {format(day, 'eee')}
                                </span>
                                <span className="text-xs font-extrabold">{format(day, 'd')}</span>

                                {/* Status dot: all done / some done / none */}
                                <div className="mt-1 flex gap-0.5">
                                    <span className={`w-1.5 h-1.5 rounded-full ${isAllCompleted ? 'bg-emerald-400 animate-pulse' : dayCompleted > 0 ? 'bg-amber-400' : 'bg-slate-300 dark:bg-slate-700'}`} />
                                </div>
                            </button>
                        );
                    })}
                </div>

                <div className="flex flex-col gap-1.5 pt-1">
                    <div className="flex justify-between items-center text-xs">
                        <span className="font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                            <CalendarIcon className="w-3.5 h-3.5 text-violet-500" />
                            {format(selectedDay, 'EEEE, MMM d')}
                            {isToday(selectedDay) && (
                                <span className="text-[10px] bg-violet-500/10 text-violet-600 dark:text-violet-400 px-2 py-0.5 rounded-full font-bold">
                                    Today
                                </span>
                            )}
                        </span>
                        <span className="font-extrabold text-violet-600 dark:text-violet-400">
                            {selectedCompleted}/{tasks.length} ({pct}%)
                        </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-200/50 dark:border-slate-800">
                        <div
                            className="h-full bg-linear-to-r from-violet-600 via-indigo-600 to-emerald-500 transition-all duration-300 rounded-full"
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* One card per habit for the selected day */}
            {tasks.length > 0 && (
                <div className="sm:hidden flex flex-col gap-3">
                    {tasks.map((task) => {
                        const completed = isCompleted(task.id, selectedDateStr);
                        const streak = getStreak(task.id);
                        const partners = partnerCount(task.id, selectedDateStr);
                        const ownedIndex = ownedIds.indexOf(task.id);

                        return (
                            <div
                                key={task.id}
                                className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${completed
                                    ? 'bg-linear-to-r from-violet-500/10 to-indigo-500/10 border-violet-500/30 dark:border-violet-500/20'
                                    : 'bg-white dark:bg-slate-900/40 border-slate-200 dark:border-slate-900 shadow-sm'
                                    }`}
                            >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <CheckInButton
                                        variant="card"
                                        taskName={task.name}
                                        dateStr={selectedDateStr}
                                        completed={completed}
                                        isFuture={isFuture}
                                        partnerCount={partners}
                                        onToggle={() => onToggle(task.id, selectedDateStr, completed)}
                                    />

                                    <div className="flex flex-col min-w-0 flex-1">
                                        {editing.taskId === task.id ? (
                                            <div className="flex items-center gap-1.5">
                                                <input
                                                    type="text"
                                                    aria-label="Habit name"
                                                    value={editing.name}
                                                    onChange={(e) => editing.setName(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') editing.save(task.id);
                                                        if (e.key === 'Escape') editing.cancel();
                                                    }}
                                                    className="bg-slate-100 dark:bg-slate-950 border border-violet-500 px-2.5 py-1 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:outline-none w-full"
                                                    autoFocus
                                                />
                                                <button
                                                    onClick={() => editing.save(task.id)}
                                                    type="button"
                                                    className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors shrink-0"
                                                    title="Save"
                                                >
                                                    <Check className="w-4 h-4 stroke-[3px]" />
                                                </button>
                                                <button
                                                    onClick={editing.cancel}
                                                    type="button"
                                                    className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-colors shrink-0"
                                                    title="Cancel"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className={`text-base font-bold truncate ${completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-white'}`}>
                                                        {task.name}
                                                    </span>
                                                    {isShared(task) && <Users className="w-3.5 h-3.5 text-indigo-500 shrink-0" />}
                                                </div>

                                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                                        {task.category || 'General'}
                                                    </span>
                                                    {streak > 0 && <StreakChip streak={streak} />}
                                                    {partners > 0 && (
                                                        <span className="flex items-center gap-1 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                                                            <Users className="w-3 h-3" />
                                                            {partners} partner{partners > 1 ? 's' : ''} done
                                                        </span>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Actions hidden behind a menu to prevent accidental taps */}
                                {task.user_id === userId && (
                                    <div className="relative flex items-center shrink-0">
                                        {activeMenuTaskId === task.id ? (
                                            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 rounded-xl shadow-lg">
                                                <button
                                                    onClick={() => onMove(task.id, -1)}
                                                    disabled={ownedIndex <= 0}
                                                    type="button"
                                                    className={`${MENU_BUTTON} hover:text-violet-500`}
                                                    title="Move up"
                                                    aria-label={`Move ${task.name} up`}
                                                >
                                                    <ArrowUp className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => onMove(task.id, 1)}
                                                    disabled={ownedIndex === -1 || ownedIndex >= ownedIds.length - 1}
                                                    type="button"
                                                    className={`${MENU_BUTTON} hover:text-violet-500`}
                                                    title="Move down"
                                                    aria-label={`Move ${task.name} down`}
                                                >
                                                    <ArrowDown className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        editing.start(task);
                                                        setActiveMenuTaskId(null);
                                                    }}
                                                    type="button"
                                                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-violet-500 transition-colors"
                                                    title="Edit habit"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        onShare(task.id);
                                                        setActiveMenuTaskId(null);
                                                    }}
                                                    type="button"
                                                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-indigo-500 transition-colors"
                                                    title="Share habit"
                                                >
                                                    <Share2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        onRemove(task);
                                                        setActiveMenuTaskId(null);
                                                    }}
                                                    type="button"
                                                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-rose-500 transition-colors"
                                                    title="Delete habit"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setActiveMenuTaskId(null)}
                                                    type="button"
                                                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                                    title="Close menu"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setActiveMenuTaskId(task.id)}
                                                type="button"
                                                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                                title="Habit Options"
                                            >
                                                <MoreVertical className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </>
    );
}

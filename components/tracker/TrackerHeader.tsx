'use client';

import type { ReactNode } from 'react';
import { format, addDays, parseISO, isSameWeek } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Loader2, Cloud, CloudOff, Bell, BellRing, Trophy } from 'lucide-react';
import type { SyncState } from '@/lib/types';
import type { ReminderPermission } from '@/hooks/useReminders';
import { toDateStr } from '@/lib/dates';

interface TrackerHeaderProps {
    currentDate: Date;
    weekStart: Date;
    syncState: SyncState;
    reminderPermission: ReminderPermission;
    onReminderClick: () => void;
    onShowBadges: () => void;
    onPrevWeek: () => void;
    onToday: () => void;
    onNextWeek: () => void;
    onPickDate: (date: Date) => void;
}

const SYNC: Record<SyncState, { label: string; className: string; icon: ReactNode }> = {
    synced: { label: 'Synced', className: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10', icon: <Cloud className="w-4 h-4" /> },
    syncing: { label: 'Syncing', className: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10', icon: <Loader2 className="w-4 h-4 animate-spin" /> },
    offline: { label: 'Offline', className: 'text-amber-600 dark:text-amber-500 bg-amber-500/10', icon: <CloudOff className="w-4 h-4" /> },
};

// Icon-only on phones (labels from sm up), always at least 40px tall for touch
const CHIP = 'h-10 min-w-10 px-2.5 sm:px-3 flex items-center justify-center gap-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-colors cursor-pointer border';
const ARROW = 'w-11 h-11 shrink-0 flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white active:bg-slate-200/60 dark:active:bg-slate-800 transition-colors cursor-pointer';

export default function TrackerHeader({
    currentDate,
    weekStart,
    syncState,
    reminderPermission,
    onReminderClick,
    onShowBadges,
    onPrevWeek,
    onToday,
    onNextWeek,
    onPickDate,
}: TrackerHeaderProps) {
    const sync = SYNC[syncState];
    const remindersOn = reminderPermission === 'granted';
    const isCurrentWeek = isSameWeek(weekStart, new Date(), { weekStartsOn: 1 });

    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center justify-between gap-2">
                <h2 className="text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight">
                    {format(currentDate, 'MMM yyyy')}
                </h2>

                <div className="flex items-center gap-1.5">
                    <span role="status" aria-label={sync.label} title={sync.label} className={`${CHIP} cursor-default border-transparent ${sync.className}`}>
                        {sync.icon}
                        <span className="hidden sm:inline">{sync.label}</span>
                    </span>
                    <button
                        type="button"
                        onClick={onReminderClick}
                        aria-label={remindersOn ? 'Send a progress reminder' : 'Enable reminders'}
                        title={remindersOn ? 'Send a progress reminder' : 'Enable reminders'}
                        className={`${CHIP} ${remindersOn
                            ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                            }`}
                    >
                        {remindersOn ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                        <span className="hidden sm:inline">Reminders</span>
                    </button>
                    <button
                        type="button"
                        onClick={onShowBadges}
                        aria-label="Streak badges"
                        title="Streak badges"
                        className={`${CHIP} bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20`}
                    >
                        <Trophy className="w-4 h-4" />
                        <span className="hidden sm:inline">Badges</span>
                    </button>
                </div>
            </div>

            {/* Week navigation: arrows around a tappable date range (opens the native date picker) */}
            <div className="flex items-center gap-2">
                <div className="flex-1 md:flex-initial flex items-center bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl">
                    <button type="button" onClick={onPrevWeek} className={ARROW} aria-label="Previous week">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <label className="relative flex-1 h-11 flex items-center justify-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer md:px-3">
                        <CalendarIcon className="w-4 h-4 text-violet-500 shrink-0" />
                        <span className="whitespace-nowrap">
                            {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d')}
                        </span>
                        <input
                            type="date"
                            aria-label="Jump to date"
                            value={toDateStr(currentDate)}
                            onChange={(e) => {
                                // parseISO reads 'yyyy-MM-dd' as local midnight (new Date() would use UTC)
                                if (e.target.value) onPickDate(parseISO(e.target.value));
                            }}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                    </label>
                    <button type="button" onClick={onNextWeek} className={ARROW} aria-label="Next week">
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
                {!isCurrentWeek && (
                    <button
                        type="button"
                        onClick={onToday}
                        className="h-11 px-4 shrink-0 rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400 text-sm font-bold active:scale-95 transition-transform cursor-pointer"
                    >
                        Today
                    </button>
                )}
            </div>
        </div>
    );
}

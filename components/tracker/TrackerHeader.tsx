'use client';

import type { ReactNode } from 'react';
import { format, addDays, parseISO } from 'date-fns';
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

const SYNC_BADGES: Record<SyncState, { label: string; className: string; icon: ReactNode }> = {
    synced: { label: 'Synced', className: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10', icon: <Cloud className="w-3 h-3" /> },
    syncing: { label: 'Syncing', className: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 animate-pulse', icon: <Loader2 className="w-3 h-3 animate-spin" /> },
    offline: { label: 'Offline', className: 'text-amber-600 dark:text-amber-500 bg-amber-500/10', icon: <CloudOff className="w-3 h-3 animate-bounce" /> },
};

const NAV_ARROW = 'h-8 w-7 sm:w-8 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-900 transition-all select-none cursor-pointer';

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
    const sync = SYNC_BADGES[syncState];
    const remindersOn = reminderPermission === 'granted';

    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-900/40 p-3.5 sm:p-4 border border-slate-200 dark:border-slate-900 rounded-2xl backdrop-blur transition-all duration-200">
            <div className="flex items-center justify-between gap-2 sm:gap-4 w-full md:w-auto">
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight shrink-0">
                    {format(currentDate, 'MMM yyyy')}
                </h2>

                {/* Sync & Reminders Badges */}
                <div className="flex items-center gap-1.5 shrink-0">
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${sync.className}`}>
                        {sync.icon}
                        <span>{sync.label}</span>
                    </div>

                    {/* Daily Reminder Notifications Bell */}
                    <button
                        type="button"
                        onClick={onReminderClick}
                        className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer border ${remindersOn
                            ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20 hover:bg-violet-500/20'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:text-violet-600 dark:hover:text-violet-400'
                            }`}
                        title={remindersOn ? 'Click to send daily reminder / test notification' : 'Enable Web Push Daily Reminders'}
                    >
                        {remindersOn ? <BellRing className="w-3 h-3 text-violet-500 animate-pulse" /> : <Bell className="w-3 h-3" />}
                        <span>Reminders</span>
                    </button>

                    {/* Streak milestones showcase */}
                    <button
                        type="button"
                        onClick={onShowBadges}
                        className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
                        title="View streak milestone badges"
                    >
                        <Trophy className="w-3 h-3" />
                        <span>Badges</span>
                    </button>
                </div>
            </div>

            <div className="flex items-center justify-between sm:justify-start gap-2 w-full md:w-auto">
                {/* Nav buttons */}
                <div className="flex items-center h-9 sm:h-10 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-0.5 sm:p-1 transition-colors">
                    <button type="button" onClick={onPrevWeek} className={NAV_ARROW} aria-label="Previous week">
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={onToday}
                        className="h-8 px-2 sm:px-3 flex items-center justify-center rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-900 transition-all select-none cursor-pointer"
                    >
                        Today
                    </button>
                    <button type="button" onClick={onNextWeek} className={NAV_ARROW} aria-label="Next week">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                {/* Jump Picker showing week start to end */}
                <div className="relative flex items-center h-9 sm:h-10 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 sm:px-3 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 transition-all cursor-pointer flex-1 sm:flex-initial justify-center">
                    <CalendarIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 shrink-0" />
                    <span className="text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 select-none whitespace-nowrap">
                        {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d')}
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
                </div>
            </div>
        </div>
    );
}

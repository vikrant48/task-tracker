'use client';

import { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Download } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Entry, MobileViewMode, Task } from '@/lib/types';
import { toDateStr } from '@/lib/dates';
import { buildCategoryOptions, matchesCategory, ALL_CATEGORIES } from '@/lib/categories';
import { buildCsv, downloadCsv } from '@/lib/csv';
import { useCheckIns } from '@/hooks/useCheckIns';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import CategoryFilter from '@/components/CategoryFilter';
import ErrorBanner from '@/components/ErrorBanner';
import LoadingState from '@/components/LoadingState';
import ViewModeSwitch from '@/components/ViewModeSwitch';
import CheckInButton from '@/components/tracker/CheckInButton';

const NAV_ARROW = 'w-11 h-11 shrink-0 flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white active:bg-slate-200/60 dark:active:bg-slate-800 transition-colors cursor-pointer';

// Calendar header for the phone cards (weeks start Monday, like the tracker)
const WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// Month view of every habit, with CSV export
export default function HistoryView({ userId }: { userId: string }) {
    const supabase = useMemo(() => createClient(), []);

    const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date());
    const [tasks, setTasks] = useState<Task[]>([]);
    const [entries, setEntries] = useState<Entry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mobileViewMode, setMobileViewMode] = useState<MobileViewMode>('cards');
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>(ALL_CATEGORIES);

    // Fetch tasks and entries for the active month
    useEffect(() => {
        // Ignore responses from a superseded request (e.g. fast month navigation)
        let cancelled = false;

        async function fetchData() {
            try {
                setLoading(true);
                setError(null);

                const { data: tasksData, error: tasksError } = await supabase
                    .from('tasks')
                    .select('*')
                    .eq('archived', false)
                    .order('sort_order', { ascending: true })
                    .order('created_at', { ascending: true });
                if (tasksError) throw tasksError;

                // Only your own check-ins (shared habits have one row per person)
                const { data: entriesData, error: entriesError } = await supabase
                    .from('entries')
                    .select('*')
                    .eq('user_id', userId)
                    .gte('entry_date', toDateStr(startOfMonth(currentMonth)))
                    .lte('entry_date', toDateStr(endOfMonth(currentMonth)));
                if (entriesError) throw entriesError;

                if (cancelled) return;
                setTasks(tasksData || []);
                setEntries(entriesData || []);
            } catch (err) {
                if (cancelled) return;
                console.error('Error fetching history:', err);
                setError((err as { message?: string })?.message || 'Failed to sync with server.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        fetchData();

        return () => {
            cancelled = true;
        };
    }, [userId, currentMonth, supabase]);

    const daysInMonth = useMemo(
        () => eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) }),
        [currentMonth]
    );
    const todayStr = toDateStr(new Date());
    // Empty cells before the 1st so dates line up under their weekday (Monday = 0)
    const monthOffset = (startOfMonth(currentMonth).getDay() + 6) % 7;

    // Same check-in behaviour as the tracker, including offline queueing
    const { enqueue } = useOfflineSync(supabase, userId, setError);
    const { isCompleted, toggle: handleToggle } = useCheckIns({ supabase, userId, entries, setEntries, enqueue, onError: setError });

    const categoryOptions = useMemo(() => buildCategoryOptions(tasks), [tasks]);
    const filteredTasks = tasks.filter((t) => matchesCategory(t, selectedCategoryFilter));

    // Export the month (all days) for the current filter
    const exportToCSV = () => {
        if (filteredTasks.length === 0) return;
        const days = daysInMonth.map(toDateStr);
        const csv = buildCsv(
            ['Task Name', 'Category', ...days],
            filteredTasks.map((task) => [
                task.name,
                task.category || 'General',
                ...days.map((d) => (isCompleted(task.id, d) ? 'Yes' : 'No')),
            ])
        );
        downloadCsv(`focusflow_history_${format(currentMonth, 'yyyy_MM')}.csv`, csv);
    };

    return (
        <div className="flex-1 flex flex-col gap-4 sm:gap-6">
            {/* Title + export */}
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight">History</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Every habit, day by day</p>
                </div>
                <button
                    type="button"
                    onClick={exportToCSV}
                    disabled={filteredTasks.length === 0}
                    aria-label="Export CSV"
                    title="Export CSV"
                    className="h-10 min-w-10 px-2.5 sm:px-4 flex items-center justify-center gap-1.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Export CSV</span>
                </button>
            </div>

            {/* Month navigation: arrows around a tappable month (opens the native month picker) */}
            <div className="flex items-center bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl md:self-start">
                <button type="button" onClick={() => setCurrentMonth((m) => subMonths(m, 1))} className={NAV_ARROW} aria-label="Previous month">
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <label className="relative flex-1 h-11 flex items-center justify-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer md:px-6">
                    <CalendarIcon className="w-4 h-4 text-violet-500" />
                    {format(currentMonth, 'MMMM yyyy')}
                    <input
                        type="month"
                        aria-label="Jump to month"
                        value={format(currentMonth, 'yyyy-MM')}
                        onChange={(e) => {
                            if (e.target.value) {
                                const [y, m] = e.target.value.split('-');
                                setCurrentMonth(new Date(parseInt(y), parseInt(m) - 1, 1));
                            }
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                </label>
                <button type="button" onClick={() => setCurrentMonth((m) => addMonths(m, 1))} className={NAV_ARROW} aria-label="Next month">
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>

            {/* Category chips and (phones only) the cards/grid switch share one row */}
            <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                    <CategoryFilter options={categoryOptions} selected={selectedCategoryFilter} onSelect={setSelectedCategoryFilter} />
                </div>
                <ViewModeSwitch value={mobileViewMode} onChange={setMobileViewMode} cardsLabel="Habit cards" gridLabel="Full month grid" />
            </div>

            {/* Phone habit cards: a month calendar per habit */}
            {mobileViewMode === 'cards' && !loading && filteredTasks.length > 0 && (
                <div className="sm:hidden flex flex-col gap-3">
                    {filteredTasks.map((task) => {
                        const completedDays = daysInMonth.filter((d) => isCompleted(task.id, toDateStr(d))).length;
                        const pct = Math.round((completedDays / daysInMonth.length) * 100);

                        return (
                            <div key={task.id} className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-900 p-4 rounded-2xl flex flex-col gap-3 shadow-sm">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <h4 className="font-bold text-base text-slate-800 dark:text-white truncate">{task.name}</h4>
                                        <span className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                            {task.category || 'General'}
                                        </span>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className="block text-base font-extrabold text-violet-600 dark:text-violet-400">{pct}%</span>
                                        <span className="block text-xs font-semibold text-slate-400">{completedDays}/{daysInMonth.length} days</span>
                                    </div>
                                </div>

                                {/* Calendar: weekday header, dates in their weekday column (weeks start Monday) */}
                                <div className="grid grid-cols-7 gap-1 text-center">
                                    {WEEKDAY_INITIALS.map((d, i) => (
                                        <span key={i} aria-hidden="true" className="text-[11px] font-bold text-slate-400 dark:text-slate-500 pb-0.5">{d}</span>
                                    ))}
                                    {Array.from({ length: monthOffset }, (_, i) => <span key={`pad-${i}`} />)}
                                    {daysInMonth.map((day) => {
                                        const dateStr = toDateStr(day);
                                        const isFuture = dateStr > todayStr;
                                        const completed = isCompleted(task.id, dateStr);

                                        return (
                                            <button
                                                key={dateStr}
                                                type="button"
                                                disabled={isFuture}
                                                onClick={() => !isFuture && handleToggle(task.id, dateStr, completed)}
                                                aria-label={`${task.name}, ${dateStr}`}
                                                aria-pressed={completed}
                                                className={`h-9 rounded-lg text-xs font-bold flex items-center justify-center transition-colors ${isFuture
                                                    ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                                                    : completed
                                                        ? 'bg-violet-600 text-white cursor-pointer'
                                                        : 'bg-slate-100 dark:bg-slate-950/60 text-slate-500 dark:text-slate-500 active:bg-slate-200 dark:active:bg-slate-800 cursor-pointer'
                                                    } ${isToday(day) ? 'ring-2 ring-emerald-500' : ''}`}
                                            >
                                                {format(day, 'd')}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

            {/* Month grid: always on tablet/desktop, on mobile only in grid mode */}
            <div className={`bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-900 rounded-2xl overflow-hidden backdrop-blur flex-1 flex-col justify-start relative transition-colors duration-200 min-h-[300px] ${mobileViewMode === 'matrix' || loading || filteredTasks.length === 0 ? 'flex' : 'hidden sm:flex'}`}>
                {loading ? (
                    <LoadingState label="Syncing history..." />
                ) : filteredTasks.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">No active habits</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mt-1">
                            {selectedCategoryFilter === ALL_CATEGORIES
                                ? 'Run over to the Weekly Tracker on the top menu to create dynamic daily habits first.'
                                : `No tasks created under the "${selectedCategoryFilter}" category.`}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto relative w-full flex-1">
                        <table className="w-full border-collapse text-left min-w-[1000px]">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-900">
                                    <th className="sticky left-0 bg-white dark:bg-slate-950 z-20 px-3 sm:px-6 py-3 sm:py-4 font-bold text-xs sm:text-sm text-slate-500 dark:text-slate-400 w-[130px] sm:w-[130px] sm:w-[220px] border-r border-slate-200 dark:border-slate-900 backdrop-blur-md shadow-sm">
                                        Routine Task
                                    </th>
                                    {daysInMonth.map((day) => {
                                        const isDayToday = isToday(day);
                                        return (
                                            <th
                                                key={toDateStr(day)}
                                                className={`px-2.5 py-4 text-center font-extrabold text-xs border-r border-slate-200/60 dark:border-slate-900/50 last:border-r-0 ${isDayToday ? 'text-violet-500 dark:text-violet-400' : 'text-slate-500 dark:text-slate-400'}`}
                                            >
                                                <div className="flex flex-col items-center min-w-[32px]">
                                                    <span className="uppercase text-[11px] tracking-wider mb-0.5">{format(day, 'eeeee')}</span>
                                                    <span className={`w-6 h-6 flex items-center justify-center rounded-full font-bold text-xs ${isDayToday ? 'bg-violet-600/10 dark:bg-violet-600/20 text-violet-600 dark:text-violet-400 ring-1 ring-violet-500/20' : ''}`}>
                                                        {format(day, 'd')}
                                                    </span>
                                                </div>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-900/50">
                                {filteredTasks.map((task) => (
                                    <tr key={task.id} className="hover:bg-slate-100/40 dark:hover:bg-slate-900/20 transition-all select-none">
                                        <td className="sticky left-0 bg-white dark:bg-slate-950 z-10 px-3 sm:px-6 py-3 sm:py-4 font-medium text-sm text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-slate-900 w-[130px] max-w-[130px] sm:w-[220px] sm:max-w-none shadow-sm backdrop-blur-md">
                                            <div className="flex flex-col truncate">
                                                <span className="truncate font-semibold text-slate-800 dark:text-slate-100">{task.name}</span>
                                                <span className="text-[11px] text-slate-500 font-extrabold tracking-wider uppercase mt-0.5 pointer-events-none select-none">
                                                    {task.category || 'General'}
                                                </span>
                                            </div>
                                        </td>
                                        {daysInMonth.map((day) => {
                                            const dateStr = toDateStr(day);
                                            const isFuture = dateStr > todayStr;
                                            const completed = isCompleted(task.id, dateStr);

                                            return (
                                                <td key={dateStr} className="px-1 py-3 text-center border-r border-slate-100 dark:border-slate-900/30 last:border-r-0">
                                                    <div className="flex justify-center items-center">
                                                        <CheckInButton
                                                            variant="compact"
                                                            taskName={task.name}
                                                            dateStr={dateStr}
                                                            completed={completed}
                                                            isFuture={isFuture}
                                                            onToggle={() => handleToggle(task.id, dateStr, completed)}
                                                        />
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

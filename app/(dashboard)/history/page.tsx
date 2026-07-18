'use client';

import React, { useState, useEffect, useOptimistic, useTransition, useRef, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
    format,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    addMonths,
    subMonths,
    isToday,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Loader2, Check, X, ShieldAlert, Download } from 'lucide-react';

interface Task {
    id: string;
    name: string;
    sort_order: number;
    archived: boolean;
    created_at: string;
    category: string;
}

interface Entry {
    id?: string;
    task_id: string;
    entry_date: string;
    completed: boolean;
}

export default function HistoryPage() {
    const supabase = createClient();
    const [userId, setUserId] = useState<string | null>(null);

    // States
    const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
    const [tasks, setTasks] = useState<Task[]>([]);
    const [entries, setEntries] = useState<Entry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filter Categories
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');

    const tableContainerRef = useRef<HTMLDivElement>(null);

    // Initial fetch setup
    useEffect(() => {
        async function init() {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (user) {
                setUserId(user.id);
            }
        }
        init();
    }, []);

    // Fetch tasks and entries for the active month
    useEffect(() => {
        if (!userId) return;

        async function fetchData() {
            try {
                setLoading(true);
                setError(null);

                // Fetch active tasks
                const { data: tasksData, error: tasksError } = await supabase
                    .from('tasks')
                    .select('*')
                    .eq('archived', false)
                    .order('sort_order', { ascending: true })
                    .order('created_at', { ascending: true });

                if (tasksError) throw tasksError;

                // Date range query
                const monthStart = startOfMonth(currentMonth);
                const monthEnd = endOfMonth(currentMonth);
                const startDateStr = format(monthStart, 'yyyy-MM-dd');
                const endDateStr = format(monthEnd, 'yyyy-MM-dd');

                // Fetch completions
                const { data: entriesData, error: entriesError } = await supabase
                    .from('entries')
                    .select('*')
                    .gte('entry_date', startDateStr)
                    .lte('entry_date', endDateStr);

                if (entriesError) throw entriesError;

                setTasks(tasksData || []);
                setEntries(entriesData || []);
            } catch (err: any) {
                console.error('Error fetching history:', err);
                setError(err.message || 'Failed to sync with server.');
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, [userId, currentMonth]);

    // Generate days in the active month
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const daysInMonth = useMemo(() => {
        return eachDayOfInterval({ start: monthStart, end: monthEnd });
    }, [currentMonth]);

    // Navigation handlers
    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

    // Optimistic UI updates
    const [optimisticEntries, setOptimisticEntries] = useOptimistic(
        entries,
        (state, action: { type: 'TOGGLE'; taskId: string; dateStr: string; completed: boolean }) => {
            const matchIndex = state.findIndex(
                (e) => e.task_id === action.taskId && e.entry_date === action.dateStr
            );

            if (matchIndex > -1) {
                const updated = [...state];
                updated[matchIndex] = { ...updated[matchIndex], completed: action.completed };
                return updated;
            } else {
                return [...state, { task_id: action.taskId, entry_date: action.dateStr, completed: action.completed }];
            }
        }
    );

    const [isPending, startTransition] = useTransition();

    const handleToggle = async (taskId: string, dateStr: string, currentCompleted: boolean) => {
        if (!userId) return;
        const newCompleted = !currentCompleted;

        // Perform mobile haptic vibration feedback
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            navigator.vibrate([15]);
        }

        // Apply optimistic updates
        startTransition(() => {
            setOptimisticEntries({
                type: 'TOGGLE',
                taskId,
                dateStr,
                completed: newCompleted,
            });
        });

        try {
            const { error: upsertError } = await supabase.from('entries').upsert(
                {
                    task_id: taskId,
                    user_id: userId,
                    entry_date: dateStr,
                    completed: newCompleted,
                    completed_at: newCompleted ? new Date().toISOString() : null,
                },
                {
                    onConflict: 'task_id,entry_date',
                }
            );

            if (upsertError) throw upsertError;

            // Sync actual backend records
            const { data: updatedEntries, error: fetchError } = await supabase
                .from('entries')
                .select('*')
                .gte('entry_date', format(monthStart, 'yyyy-MM-dd'))
                .lte('entry_date', format(monthEnd, 'yyyy-MM-dd'));

            if (!fetchError && updatedEntries) {
                setEntries(updatedEntries);
            }
        } catch (err: any) {
            console.error('Error toggling entry in history:', err);
            setError('Connection error. Change may not have saved.');
        }
    };

    // Filter tasks based on category tab selection
    const filteredTasks = tasks.filter(
        (t) => selectedCategoryFilter === 'All' || t.category === selectedCategoryFilter
    );

    // Export current monthly view data to CSV spreadsheet format (Exports all days of the month)
    const exportToCSV = () => {
        if (filteredTasks.length === 0) return;

        const headers = ['Task Name', 'Category', ...daysInMonth.map(d => format(d, 'yyyy-MM-dd'))];
        const rows = filteredTasks.map(task => {
            return [
                `"${task.name.replace(/"/g, '""')}"`,
                task.category || 'General',
                ...daysInMonth.map(d => {
                    const dateStr = format(d, 'yyyy-MM-dd');
                    const entryMatch = entries.find(e => e.task_id === task.id && e.entry_date === dateStr);
                    return entryMatch?.completed ? 'Yes' : 'No';
                })
            ];
        });

        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `focusflow_history_${format(currentMonth, 'yyyy_MM')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="flex-1 flex flex-col gap-6">
            {/* Month scroll headers */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900/40 p-4 border border-slate-205 dark:border-slate-900 rounded-2xl backdrop-blur transition-colors duration-200">
                <div>
                    <h2 className="text-xl sm:text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight">
                        All History Tracker
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                        Full history of your routine habits
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-1 transition-colors">
                        <button
                            onClick={prevMonth}
                            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-900 transition-all font-medium select-none cursor-pointer"
                            aria-label="Previous month"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="px-4 text-xs sm:text-sm font-bold text-slate-700 dark:text-white min-w-[120px] text-center select-none">
                            {format(currentMonth, 'MMMM yyyy')}
                        </span>
                        <button
                            onClick={nextMonth}
                            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-900 transition-all font-medium select-none cursor-pointer"
                            aria-label="Next month"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Jump Picker */}
                    <div className="relative flex items-center bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-500 dark:text-slate-400 focus-within:text-slate-800 focus-within:dark:text-white focus-within:border-slate-400 focus-within:dark:border-slate-700 transition-all">
                        <CalendarIcon className="w-4 h-4 mr-2" />
                        <input
                            type="month"
                            value={format(currentMonth, 'yyyy-MM')}
                            onChange={(e) => {
                                if (e.target.value) {
                                    const [y, m] = e.target.value.split('-');
                                    setCurrentMonth(new Date(parseInt(y), parseInt(m) - 1, 1));
                                }
                            }}
                            className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none w-28 cursor-pointer select-none"
                        />
                    </div>
                </div>
            </div>

            {/* Sub-header controls: Category filters & CSV Export */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Category Filter Tabs */}
                <div className="flex flex-wrap gap-1.5 p-1.5 bg-white dark:bg-slate-900/30 border border-slate-205 dark:border-slate-900 rounded-2xl w-fit transition-colors">
                    {['All', 'General', 'Work', 'Health', 'Personal'].map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategoryFilter(cat)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer select-none transition-all ${selectedCategoryFilter === cat
                                ? 'bg-gradient-to-tr from-violet-600 to-indigo-600 border border-violet-500 text-white shadow'
                                : 'text-slate-500 dark:text-slate-400 border border-transparent hover:text-slate-850 dark:hover:text-slate-200 hover:border-slate-200 dark:hover:border-slate-800'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* CSV Download Button */}
                <button
                    onClick={exportToCSV}
                    disabled={filteredTasks.length === 0}
                    className="flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white font-bold text-xs py-2 px-4 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed select-none transition-all cursor-pointer whitespace-nowrap"
                >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Export CSV
                </button>
            </div>

            {error && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm animate-slide-in">
                    <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                    <span className="font-semibold">{error}</span>
                    <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-650">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Grid Container */}
            <div className="bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-900 rounded-2xl overflow-hidden backdrop-blur flex-1 flex flex-col justify-start relative transition-colors duration-200 min-h-[300px]">
                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 gap-3">
                        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
                        <span className="text-sm text-slate-500 dark:text-slate-400 font-semibold">Syncing history...</span>
                    </div>
                ) : filteredTasks.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                        <h3 className="text-lg font-bold text-slate-850 dark:text-white">No active habits</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mt-1">
                            {selectedCategoryFilter === 'All'
                                ? 'Run over to the Weekly Tracker on the top menu to create dynamic daily habits first.'
                                : `No tasks created under the "${selectedCategoryFilter}" category.`}
                        </p>
                    </div>
                ) : (
                    <div ref={tableContainerRef} className="overflow-x-auto relative w-full flex-1">
                        <table className="w-full border-collapse text-left min-w-[1000px]">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-900">
                                    <th className="sticky left-0 bg-white dark:bg-slate-950 z-20 px-6 py-4 font-bold text-xs sm:text-sm text-slate-500 dark:text-slate-450 w-[220px] border-r border-slate-200 dark:border-slate-900 backdrop-blur-md shadow-sm">
                                        Routine Task
                                    </th>
                                    {daysInMonth.map((day, idx) => {
                                        const isDayToday = isToday(day);
                                        return (
                                            <th
                                                key={idx}
                                                className={`px-2.5 py-4 text-center font-extrabold text-xs border-r border-slate-200/60 dark:border-slate-900/50 last:border-r-0 ${isDayToday ? 'text-violet-500 dark:text-violet-400' : 'text-slate-500 dark:text-slate-400'
                                                    }`}
                                            >
                                                <div className="flex flex-col items-center min-w-[32px]">
                                                    <span className="uppercase text-[9px] tracking-wider mb-0.5">
                                                        {format(day, 'eeeee')}
                                                    </span>
                                                    <span
                                                        className={`w-6 h-6 flex items-center justify-center rounded-full font-bold text-xs ${isDayToday ? 'bg-violet-600/10 dark:bg-violet-600/20 text-violet-600 dark:text-violet-400 ring-1 ring-violet-500/20' : ''
                                                            }`}
                                                    >
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
                                        {/* Task Name + Category underlabel */}
                                        <td className="sticky left-0 bg-white dark:bg-slate-950 z-10 px-6 py-4 font-medium text-sm text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-slate-900 w-[220px] shadow-sm backdrop-blur-md">
                                            <div className="flex flex-col truncate">
                                                <span className="truncate font-semibold text-slate-800 dark:text-slate-100">{task.name}</span>
                                                <span className="text-[9px] text-slate-500 font-extrabold tracking-wider uppercase mt-0.5 pointer-events-none select-none">
                                                    {task.category || 'General'}
                                                </span>
                                            </div>
                                        </td>
                                        {daysInMonth.map((day, idx) => {
                                            const dateStr = format(day, 'yyyy-MM-dd');
                                            const entryMatch = optimisticEntries.find(
                                                (e) => e.task_id === task.id && e.entry_date === dateStr
                                            );
                                            const isCompleted = entryMatch?.completed || false;

                                            return (
                                                <td
                                                    key={idx}
                                                    className="px-1 py-3 text-center border-r border-slate-100 dark:border-slate-900/30 last:border-r-0"
                                                >
                                                    <div className="flex justify-center items-center">
                                                        <button
                                                            onClick={() => handleToggle(task.id, dateStr, isCompleted)}
                                                            type="button"
                                                            className={`w-8 h-8 rounded-lg flex items-center justify-center focus:outline-none transition-all active:scale-90 border cursor-pointer ${isCompleted
                                                                ? 'bg-gradient-to-tr from-violet-600 to-indigo-600 border-violet-500 text-white shadow shadow-violet-500/20'
                                                                : 'bg-slate-100 dark:bg-slate-950/40 hover:bg-slate-200 dark:hover:bg-slate-950 border-slate-205 dark:border-slate-850 text-transparent hover:text-slate-400 dark:hover:text-slate-700'
                                                                }`}
                                                        >
                                                            <Check className="w-3.5 h-3.5 stroke-[3px]" />
                                                        </button>
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

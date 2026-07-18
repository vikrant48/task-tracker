'use client';

import React, { useState, useEffect, useOptimistic, useTransition, useRef } from 'react';
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
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Loader2, Check, X, ShieldAlert } from 'lucide-react';

interface Task {
    id: string;
    name: string;
    sort_order: number;
    archived: boolean;
    created_at: string;
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
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

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

    return (
        <div className="flex-1 flex flex-col gap-6">
            {/* Month scroll headers */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/40 p-4 border border-slate-900 rounded-2xl backdrop-blur">
                <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                        All History Tracker
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        Full history of your routine habits
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1">
                        <button
                            onClick={prevMonth}
                            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-all font-medium"
                            aria-label="Previous month"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="px-4 text-sm font-semibold text-white">
                            {format(currentMonth, 'MMMM yyyy')}
                        </span>
                        <button
                            onClick={nextMonth}
                            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-all font-medium"
                            aria-label="Next month"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Jump Picker */}
                    <div className="relative flex items-center bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-400 focus-within:text-white focus-within:border-slate-700 transition-all">
                        <CalendarIcon className="w-4 h-4 mr-2" />
                        <input
                            type="month"
                            value={format(currentMonth, 'yyyy-MM')}
                            onChange={(e) => {
                                if (e.target.value) {
                                    // To parse month/year correctly
                                    const [y, m] = e.target.value.split('-');
                                    setCurrentMonth(new Date(parseInt(y), parseInt(m) - 1, 1));
                                }
                            }}
                            className="bg-transparent text-xs font-medium text-slate-300 focus:outline-none w-28 cursor-pointer select-none"
                        />
                    </div>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2 bg-red-950/40 border border-red-900/50 text-red-400 px-4 py-3 rounded-xl text-sm">
                    <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="ml-auto text-red-400/80 hover:text-red-300">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Grid Container */}
            <div className="bg-slate-905/30 border border-slate-900 rounded-2xl overflow-hidden backdrop-blur flex-1 flex flex-col justify-start">
                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 gap-3 min-h-[300px]">
                        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
                        <span className="text-sm text-slate-400 font-medium">Syncing history...</span>
                    </div>
                ) : tasks.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center min-h-[300px]">
                        <h3 className="text-lg font-semibold text-white">No tasks created yet</h3>
                        <p className="text-sm text-slate-500 max-w-sm mt-1">
                            Run over to the Weekly Tracker on the top menu to create dynamic daily habits first.
                        </p>
                    </div>
                ) : (
                    <div ref={tableContainerRef} className="overflow-x-auto relative w-full flex-1">
                        <table className="w-full border-collapse text-left min-w-[1000px]">
                            <thead>
                                <tr className="border-b border-slate-900">
                                    <th className="sticky left-0 bg-slate-950/80 z-20 px-6 py-4 font-semibold text-sm text-slate-400 w-[200px] shadow-[4px_0_12px_-4px_rgba(0,0,0,0.5)] border-r border-slate-900 backdrop-blur-md">
                                        Routine Task
                                    </th>
                                    {daysInMonth.map((day, idx) => {
                                        const isDayToday = isToday(day);
                                        return (
                                            <th
                                                key={idx}
                                                className={`px-2.5 py-4 text-center font-semibold text-xs border-r border-slate-900/50 last:border-r-0 ${isDayToday ? 'text-violet-400' : 'text-slate-400'
                                                    }`}
                                            >
                                                <div className="flex flex-col items-center min-w-[32px]">
                                                    <span className="uppercase text-[9px] tracking-wider mb-0.5">
                                                        {format(day, 'eeeee')}
                                                    </span>
                                                    <span
                                                        className={`w-6 h-6 flex items-center justify-center rounded-full font-bold text-xs ${isDayToday ? 'bg-violet-600/20 text-violet-400 ring-1 ring-violet-500/30' : ''
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
                            <tbody className="divide-y divide-slate-900/50">
                                {tasks.map((task) => (
                                    <tr key={task.id} className="hover:bg-slate-900/20 transition-all select-none">
                                        <td className="sticky left-0 bg-slate-950/80 z-10 px-6 py-4 font-medium text-sm text-slate-200 border-r border-slate-900 w-[200px] shadow-[4px_0_12px_-4px_rgba(0,0,0,0.5)] truncate backdrop-blur-md">
                                            {task.name}
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
                                                    className="px-1 py-3 text-center border-r border-slate-900/30 last:border-r-0"
                                                >
                                                    <div className="flex justify-center items-center">
                                                        <button
                                                            onClick={() => handleToggle(task.id, dateStr, isCompleted)}
                                                            type="button"
                                                            className={`w-8 h-8 rounded-lg flex items-center justify-center focus:outline-none transition-all active:scale-90 border cursor-pointer ${isCompleted
                                                                    ? 'bg-gradient-to-tr from-violet-600 to-indigo-600 border-violet-500 text-white shadow shadow-violet-500/20'
                                                                    : 'bg-slate-950/40 hover:bg-slate-950 border-slate-850 text-transparent hover:text-slate-800'
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

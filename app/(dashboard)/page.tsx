'use client';

import React, { useState, useEffect, useOptimistic, useTransition, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
    format,
    startOfWeek,
    addDays,
    subDays,
    isSameDay,
    parseISO,
    isToday,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus, Loader2, Check, X, ShieldAlert, CheckSquare } from 'lucide-react';

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

export default function WeeklyTracker() {
    const supabase = createClient();
    const [userId, setUserId] = useState<string | null>(null);

    // States
    const [currentDate, setCurrentDate] = useState<Date>(new Date());
    const [tasks, setTasks] = useState<Task[]>([]);
    const [entries, setEntries] = useState<Entry[]>([]);
    const [loading, setLoading] = useState(true);
    const [addingTask, setAddingTask] = useState(false);
    const [newTaskName, setNewTaskName] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Reference for scrolling
    const tableContainerRef = useRef<HTMLDivElement>(null);

    // Fetch current user and data
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

    // Fetch tasks and entries when user or date changes
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

                // Date range for current week (Mon to Sun)
                const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
                const weekEnd = addDays(weekStart, 6);
                const startDateStr = format(weekStart, 'yyyy-MM-dd');
                const endDateStr = format(weekEnd, 'yyyy-MM-dd');

                // Fetch entries for this range
                const { data: entriesData, error: entriesError } = await supabase
                    .from('entries')
                    .select('*')
                    .gte('entry_date', startDateStr)
                    .lte('entry_date', endDateStr);

                if (entriesError) throw entriesError;

                setTasks(tasksData || []);
                setEntries(entriesData || []);
            } catch (err: any) {
                console.error('Error fetching data:', err);
                setError(err.message || 'Failed to sync with server.');
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, [userId, currentDate]);

    // Generate 7 days of the week starting from Monday
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    // Determine navigation
    const prevWeek = () => setCurrentDate(subDays(currentDate, 7));
    const nextWeek = () => setCurrentDate(addDays(currentDate, 7));
    const jumpToToday = () => setCurrentDate(new Date());

    // Optimistic UI state configuration
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

    // Toggle checklist complete
    const handleToggle = async (taskId: string, dateStr: string, currentCompleted: boolean) => {
        if (!userId) return;
        const newCompleted = !currentCompleted;

        // Trigger optimistic UI update
        startTransition(() => {
            setOptimisticEntries({
                type: 'TOGGLE',
                taskId,
                dateStr,
                completed: newCompleted,
            });
        });

        try {
            // Background Sync to Supabase
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

            // Refetch actual records to sync DB state
            const { data: updatedEntries, error: fetchError } = await supabase
                .from('entries')
                .select('*')
                .gte('entry_date', format(weekStart, 'yyyy-MM-dd'))
                .lte('entry_date', format(addDays(weekStart, 6), 'yyyy-MM-dd'));

            if (!fetchError && updatedEntries) {
                setEntries(updatedEntries);
            }
        } catch (err: any) {
            console.error('Error toggling entry:', err);
            setError('Connection error. Change may not have saved.');
        }
    };

    // Add a task
    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskName.trim() || !userId) return;

        setAddingTask(true);
        setError(null);

        const nextOrder = tasks.length > 0 ? Math.max(...tasks.map((t) => t.sort_order)) + 1 : 0;

        try {
            const { data: addedTask, error: addError } = await supabase
                .from('tasks')
                .insert({
                    name: newTaskName.trim(),
                    sort_order: nextOrder,
                    user_id: userId,
                })
                .select()
                .single();

            if (addError) throw addError;

            if (addedTask) {
                setTasks((prev) => [...prev, addedTask]);
                setNewTaskName('');
            }
        } catch (err: any) {
            console.error('Error adding task:', err);
            setError(err.message || 'Failed to create task.');
        } finally {
            setAddingTask(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col gap-6">
            {/* Header controls layout */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/40 p-4 border border-slate-900 rounded-2xl backdrop-blur">
                <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                        {format(currentDate, 'MMMM yyyy')}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        Week of {format(weekStart, 'MMM d, yyyy')}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {/* Nav buttons */}
                    <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1">
                        <button
                            onClick={prevWeek}
                            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-all"
                            aria-label="Previous week"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                            onClick={jumpToToday}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-900 transition-all"
                        >
                            Today
                        </button>
                        <button
                            onClick={nextWeek}
                            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-all"
                            aria-label="Next week"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Jump Picker */}
                    <div className="relative flex items-center bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-400 focus-within:text-white focus-within:border-slate-700 transition-all">
                        <CalendarIcon className="w-4 h-4 mr-2" />
                        <input
                            type="date"
                            value={format(currentDate, 'yyyy-MM-dd')}
                            onChange={(e) => {
                                if (e.target.value) {
                                    setCurrentDate(new Date(e.target.value));
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

            {/* Main Grid Card */}
            <div className="bg-slate-900/30 border border-slate-900 rounded-2xl overflow-hidden backdrop-blur flex-1 flex flex-col justify-start">
                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 gap-3 min-h-[300px]">
                        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
                        <span className="text-sm text-slate-400 font-medium">Syncing routine...</span>
                    </div>
                ) : tasks.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center min-h-[300px]">
                        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4">
                            <CheckSquare className="w-8 h-8 text-slate-700" />
                        </div>
                        <h3 className="text-lg font-semibold text-white">No tasks created yet</h3>
                        <p className="text-sm text-slate-500 max-w-sm mt-1">
                            Add your first habits or daily tasks below to start tracking your routine.
                        </p>
                    </div>
                ) : (
                    /* Table Container with sticky styling */
                    <div ref={tableContainerRef} className="overflow-x-auto relative w-full flex-1">
                        <table className="w-full border-collapse text-left min-w-[700px]">
                            <thead>
                                <tr className="border-b border-slate-900">
                                    {/* Sticky Task Name Column Header */}
                                    <th className="sticky left-0 bg-slate-950/80 z-20 px-6 py-4 font-semibold text-sm text-slate-400 w-[240px] shadow-[4px_0_12px_-4px_rgba(0,0,0,0.5)] border-r border-slate-900 backdrop-blur-md">
                                        Routine Task
                                    </th>
                                    {/* 7 Days Column Header */}
                                    {weekDays.map((day, idx) => {
                                        const isDayToday = isToday(day);
                                        return (
                                            <th
                                                key={idx}
                                                className={`px-4 py-4 text-center font-semibold text-xs border-r border-slate-900/50 last:border-r-0 ${isDayToday ? 'text-violet-400' : 'text-slate-400'
                                                    }`}
                                            >
                                                <div className="flex flex-col items-center">
                                                    <span className="uppercase text-[10px] tracking-wider mb-0.5">
                                                        {format(day, 'eee')}
                                                    </span>
                                                    <span
                                                        className={`w-7 h-7 flex items-center justify-center rounded-full font-bold text-sm tracking-tight ${isDayToday ? 'bg-violet-600/20 text-violet-400 ring-2 ring-violet-500/30' : ''
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
                                        {/* Sticky Task Name Row Cell */}
                                        <td className="sticky left-0 bg-slate-950/80 z-10 px-6 py-4 font-medium text-sm text-slate-200 border-r border-slate-900 w-[240px] shadow-[4px_0_12px_-4px_rgba(0,0,0,0.5)] truncate backdrop-blur-md">
                                            {task.name}
                                        </td>
                                        {/* 7 Days Interactive Checkboxes */}
                                        {weekDays.map((day, idx) => {
                                            const dateStr = format(day, 'yyyy-MM-dd');
                                            const entryMatch = optimisticEntries.find(
                                                (e) => e.task_id === task.id && e.entry_date === dateStr
                                            );
                                            const isCompleted = entryMatch?.completed || false;

                                            return (
                                                <td
                                                    key={idx}
                                                    className="px-2 py-3 text-center border-r border-slate-900/30 last:border-r-0"
                                                >
                                                    <div className="flex justify-center items-center">
                                                        <button
                                                            onClick={() => handleToggle(task.id, dateStr, isCompleted)}
                                                            type="button"
                                                            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center focus:outline-none transition-all active:scale-90 border cursor-pointer ${isCompleted
                                                                ? 'bg-gradient-to-tr from-violet-600 to-indigo-600 border-violet-500 text-white shadow-lg shadow-violet-500/25 ring-2 ring-violet-500/20'
                                                                : 'bg-slate-950/40 hover:bg-slate-950 border-slate-800 text-transparent hover:text-slate-700'
                                                                }`}
                                                        >
                                                            <Check className="w-5 h-5 stroke-[3px] transition-transform" />
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

            {/* Write New Task Form */}
            <form
                onSubmit={handleAddTask}
                className="flex items-center gap-2 bg-slate-900/40 p-3 border border-slate-900 rounded-2xl backdrop-blur mt-auto"
            >
                <input
                    value={newTaskName}
                    onChange={(e) => setNewTaskName(e.target.value)}
                    disabled={addingTask}
                    placeholder="I want to work on..."
                    className="flex-1 appearance-none bg-slate-950 border border-slate-850 px-4 py-2.5 rounded-xl text-sm placeholder-slate-500 text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-transparent transition-all"
                />
                <button
                    type="submit"
                    disabled={addingTask || !newTaskName.trim()}
                    className="flex items-center justify-center bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl disabled:opacity-40 transition-all select-none duration-155 cursor-pointer whitespace-nowrap"
                >
                    {addingTask ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <>
                            <Plus className="w-4 h-4 mr-1.5" />
                            Add Task
                        </>
                    )}
                </button>
            </form>
        </div>
    );
}

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
    format,
    subDays,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    parseISO,
    isWithinInterval,
    differenceInCalendarDays,
} from 'date-fns';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
} from 'recharts';
import { Flame, Award, Percent, Calendar as CalendarIcon, Loader2, RefreshCw } from 'lucide-react';

interface Task {
    id: string;
    name: string;
    sort_order: number;
    archived: boolean;
    created_at: string;
}

interface Entry {
    id: string;
    task_id: string;
    entry_date: string;
    completed: boolean;
}

type RangeOption = '7' | '30' | 'month' | '90';

export default function AnalyticsPage() {
    const supabase = createClient();
    const [userId, setUserId] = useState<string | null>(null);

    // States
    const [tasks, setTasks] = useState<Task[]>([]);
    const [entries, setEntries] = useState<Entry[]>([]);
    const [loading, setLoading] = useState(true);
    const [range, setRange] = useState<RangeOption>('30');
    const [currentMonthDate] = useState<Date>(new Date());

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

    // Fetch all user tasks and entries
    useEffect(() => {
        if (!userId) return;

        async function fetchData() {
            try {
                setLoading(true);

                const { data: tasksData, error: tasksError } = await supabase
                    .from('tasks')
                    .select('*')
                    .eq('archived', false);

                if (tasksError) throw tasksError;

                const { data: entriesData, error: entriesError } = await supabase
                    .from('entries')
                    .select('*')
                    .eq('completed', true);

                if (entriesError) throw entriesError;

                setTasks(tasksData || []);
                setEntries(entriesData || []);
            } catch (err) {
                console.error('Error fetching analytics data:', err);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, [userId]);

    // Determine start/end date for selected range filter
    const rangeInterval = useMemo(() => {
        const today = new Date();
        let start: Date;
        const end = today;

        if (range === '7') {
            start = subDays(today, 6);
        } else if (range === '30') {
            start = subDays(today, 29);
        } else if (range === '90') {
            start = subDays(today, 89);
        } else {
            // Current Month
            start = startOfMonth(today);
        }

        return { start, end };
    }, [range]);

    // Streak calculations and completion metrics per task
    const stats = useMemo(() => {
        if (tasks.length === 0) return [];

        return tasks.map((task) => {
            const taskEntries = entries.filter((e) => e.task_id === task.id);
            const completedEntries = taskEntries.map((e) => e.entry_date);

            // 1. Calculate streaks (overall history)
            const sortedCompletedDates = Array.from(new Set(completedEntries))
                .sort((a, b) => a.localeCompare(b))
                .map((d) => parseISO(d));

            let currentStreak = 0;
            let longestStreak = 0;

            if (sortedCompletedDates.length > 0) {
                // Longest Streak
                let tempStreak = 0;
                let prevDate: Date | null = null;

                for (const date of sortedCompletedDates) {
                    if (prevDate === null) {
                        tempStreak = 1;
                    } else {
                        const diff = differenceInCalendarDays(date, prevDate);
                        if (diff === 1) {
                            tempStreak += 1;
                        } else if (diff > 1) {
                            longestStreak = Math.max(longestStreak, tempStreak);
                            tempStreak = 1;
                        }
                    }
                    prevDate = date;
                }
                longestStreak = Math.max(longestStreak, tempStreak);

                // Current Streak
                const today = new Date();
                const yesterday = subDays(today, 1);
                const todayStr = format(today, 'yyyy-MM-dd');
                const yesterdayStr = format(yesterday, 'yyyy-MM-dd');

                const hasToday = completedEntries.includes(todayStr);
                const hasYesterday = completedEntries.includes(yesterdayStr);

                if (hasToday || hasYesterday) {
                    let checkDate = hasToday ? today : yesterday;
                    while (true) {
                        const checkStr = format(checkDate, 'yyyy-MM-dd');
                        if (completedEntries.includes(checkStr)) {
                            currentStreak += 1;
                            checkDate = subDays(checkDate, 1);
                        } else {
                            break;
                        }
                    }
                }
            }

            // 2. Completion rate in selected filter range
            const daysInRange = eachDayOfInterval(rangeInterval);
            let completionsInRange = 0;

            daysInRange.forEach((day) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                if (completedEntries.includes(dateStr)) {
                    completionsInRange += 1;
                }
            });

            const rate = daysInRange.length ? Math.round((completionsInRange / daysInRange.length) * 100) : 0;

            return {
                id: task.id,
                name: task.name,
                currentStreak,
                longestStreak,
                rate,
            };
        });
    }, [tasks, entries, rangeInterval]);

    // Overall daily tracker rates across the current month for Charting
    const chartData = useMemo(() => {
        if (tasks.length === 0) return [];

        const monthStart = startOfMonth(currentMonthDate);
        const monthEnd = endOfMonth(currentMonthDate);
        const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

        return daysInMonth.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const completedToday = entries.filter((e) => e.entry_date === dateStr).length;
            const totalTasks = tasks.length;
            const rate = totalTasks ? Math.round((completedToday / totalTasks) * 100) : 0;

            return {
                dateLabel: format(day, 'MMM d'),
                rate,
                completed: completedToday,
            };
        });
    }, [tasks, entries, currentMonthDate]);

    return (
        <div className="flex-1 flex flex-col gap-6">
            {/* Sub header and Range controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/40 p-4 border border-slate-900 rounded-2xl backdrop-blur">
                <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                        Habit Analytics
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        Visualize your routines, streaks, and completion rates
                    </p>
                </div>

                {/* Filter ranges */}
                <div className="flex bg-slate-950 border border-slate-800 rounded-xl p-1 self-start sm:self-auto">
                    <button
                        onClick={() => setRange('7')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${range === '7' ? 'bg-violet-600 text-white shadow' : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        7D
                    </button>
                    <button
                        onClick={() => setRange('30')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${range === '30' ? 'bg-violet-600 text-white shadow' : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        30D
                    </button>
                    <button
                        onClick={() => setRange('month')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${range === 'month' ? 'bg-violet-600 text-white shadow' : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        Month
                    </button>
                    <button
                        onClick={() => setRange('90')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${range === '90' ? 'bg-violet-600 text-white shadow' : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        90D
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center p-12 gap-3 min-h-[300px]">
                    <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
                    <span className="text-sm text-slate-400 font-medium">Analyzing habits...</span>
                </div>
            ) : tasks.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-900/10 border border-slate-900 rounded-2xl min-h-[300px]">
                    <h3 className="text-lg font-semibold text-white">No data to display</h3>
                    <p className="text-sm text-slate-500 max-w-sm mt-1">
                        Create tasks and record completions in Weekly Tracker first.
                    </p>
                </div>
            ) : (
                <>
                    {/* Daily completion rate across month chart */}
                    <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-4 sm:p-6 backdrop-blur">
                        <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                            <CalendarIcon className="w-4 h-4 text-violet-400" />
                            Overall Daily Completion % ({format(currentMonthDate, 'MMMM yyyy')})
                        </h3>
                        <div className="h-64 w-full text-xs font-medium">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                    <XAxis dataKey="dateLabel" stroke="#64748b" tickLine={false} />
                                    <YAxis domain={[0, 100]} stroke="#64748b" tickLine={false} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#090d16',
                                            borderColor: '#1e293b',
                                            borderRadius: '8px',
                                            color: '#f8fafc',
                                        }}
                                        labelStyle={{ color: '#94a3b8' }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="rate"
                                        name="Completed %"
                                        stroke="#8b5cf6"
                                        strokeWidth={2}
                                        fillOpacity={1}
                                        fill="url(#colorRate)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Cards metrics lists per task */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {stats.map((taskStat) => (
                            <div
                                key={taskStat.id}
                                className="bg-slate-900/30 border border-slate-900 rounded-2xl p-5 backdrop-blur flex justify-between items-center group hover:border-slate-800/80 transition-all shadow-lg"
                            >
                                <div className="flex flex-col gap-1 max-w-[65%]">
                                    <h4 className="font-semibold text-sm text-slate-100 group-hover:text-violet-400 transition-colors truncate">
                                        {taskStat.name}
                                    </h4>
                                    <div className="flex items-center gap-3.5 mt-2.5">
                                        {/* Current Streak badge */}
                                        <div className="flex items-center text-xs text-amber-500 font-bold bg-amber-500/10 px-2.5 py-1 rounded-lg">
                                            <Flame className="w-3.5 h-3.5 mr-1 fill-amber-500" />
                                            <span>{taskStat.currentStreak}d streak</span>
                                        </div>

                                        {/* Longest streak badge */}
                                        <div className="flex items-center text-xs text-indigo-400 font-bold bg-indigo-500/10 px-2.5 py-1 rounded-lg">
                                            <Award className="w-3.5 h-3.5 mr-1" />
                                            <span>Best: {taskStat.longestStreak}d</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Progress Circle or Box */}
                                <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-950 border border-slate-900 min-w-[70px]">
                                    <Percent className="w-3.5 h-3.5 text-violet-400 mb-0.5" />
                                    <span className="text-lg font-extrabold text-white tracking-tight leading-none">
                                        {taskStat.rate}%
                                    </span>
                                    <span className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider mt-1">
                                        Rate
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

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
    startOfWeek,
    addDays,
} from 'date-fns';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
} from 'recharts';
import { Flame, Award, Percent, Calendar as CalendarIcon, Loader2, ArrowUpRight, ArrowDownRight, Sparkles, TrendingUp } from 'lucide-react';

interface Task {
    id: string;
    name: string;
    sort_order: number;
    archived: boolean;
    created_at: string;
    category: string;
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

    // Analytics Filters
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');

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

    // Filter tasks by selected category
    const filteredTasks = useMemo(() => {
        return tasks.filter((t) => selectedCategoryFilter === 'All' || t.category === selectedCategoryFilter);
    }, [tasks, selectedCategoryFilter]);

    const filteredTaskIds = useMemo(() => {
        return filteredTasks.map((t) => t.id);
    }, [filteredTasks]);

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
            start = startOfMonth(today);
        }

        return { start, end };
    }, [range]);

    // Streak calculations and completion metrics per task (filtered by category)
    const stats = useMemo(() => {
        if (filteredTasks.length === 0) return [];

        return filteredTasks.map((task) => {
            const taskEntries = entries.filter((e) => e.task_id === task.id);
            const completedEntries = taskEntries.map((e) => e.entry_date);

            const sortedCompletedDates = Array.from(new Set(completedEntries))
                .sort((a, b) => a.localeCompare(b))
                .map((d) => parseISO(d));

            let currentStreak = 0;
            let longestStreak = 0;

            if (sortedCompletedDates.length > 0) {
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
                category: task.category || 'General',
                currentStreak,
                longestStreak,
                rate,
            };
        });
    }, [filteredTasks, entries, rangeInterval]);

    // Overall daily completion rates for Charting (filtered by category)
    const chartData = useMemo(() => {
        if (filteredTasks.length === 0) return [];

        const monthStart = startOfMonth(currentMonthDate);
        const monthEnd = endOfMonth(currentMonthDate);
        const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

        return daysInMonth.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const completedToday = entries.filter((e) => filteredTaskIds.includes(e.task_id) && e.entry_date === dateStr).length;
            const totalTasks = filteredTasks.length;
            const rate = totalTasks ? Math.round((completedToday / totalTasks) * 100) : 0;

            return {
                dateLabel: format(day, 'MMM d'),
                rate,
                completed: completedToday,
            };
        });
    }, [filteredTasks, filteredTaskIds, entries, currentMonthDate]);

    // GitHub-style contribution calendar data (last 26 weeks)
    const heatmapWeeks = useMemo(() => {
        const today = new Date();
        const gridStart = startOfWeek(subDays(today, 26 * 7), { weekStartsOn: 0 }); // Align grid start on Sunday
        const allGridDays = eachDayOfInterval({ start: gridStart, end: today });

        const weeks: Date[][] = [];
        let currentWeek: Date[] = [];

        allGridDays.forEach((day) => {
            currentWeek.push(day);
            if (currentWeek.length === 7) {
                weeks.push(currentWeek);
                currentWeek = [];
            }
        });

        if (currentWeek.length > 0) {
            while (currentWeek.length < 7) {
                currentWeek.push(addDays(currentWeek[currentWeek.length - 1], 1));
            }
            weeks.push(currentWeek);
        }

        return weeks;
    }, []);

    // Behavioral insights calculator (Weekday aggregates and period change)
    const behavioralInsights = useMemo(() => {
        if (filteredTasks.length === 0 || entries.length === 0) return null;

        const dayOfWeekCompletions = Array(7).fill(0).map(() => ({ completed: 0, totalExpected: 0 }));

        // Accumulate historical records
        entries.forEach((e) => {
            if (!filteredTaskIds.includes(e.task_id)) return;
            try {
                const dateObj = parseISO(e.entry_date);
                const dow = dateObj.getDay();
                dayOfWeekCompletions[dow].completed += 1;
            } catch (err) { }
        });

        // Find date boundaries of logs
        const entryDates = entries.filter(e => filteredTaskIds.includes(e.task_id)).map((e) => e.entry_date);
        let minDateStr = format(subDays(new Date(), 30), 'yyyy-MM-dd');
        let maxDateStr = format(new Date(), 'yyyy-MM-dd');
        if (entryDates.length > 0) {
            const sorted = [...entryDates].sort();
            minDateStr = sorted[0];
            maxDateStr = sorted[sorted.length - 1];
        }

        const loggedDays = eachDayOfInterval({ start: parseISO(minDateStr), end: parseISO(maxDateStr) });
        loggedDays.forEach((day) => {
            const dow = day.getDay();
            dayOfWeekCompletions[dow].totalExpected += filteredTasks.length;
        });

        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        let bestDayIdx = 0;
        let worstDayIdx = 0;
        let maxRate = -1;
        let minRate = 2.0;

        dayNames.forEach((_, idx) => {
            const comp = dayOfWeekCompletions[idx].completed;
            const exp = dayOfWeekCompletions[idx].totalExpected;
            const rate = exp > 0 ? comp / exp : 0;

            if (exp > 0) {
                if (rate > maxRate) {
                    maxRate = rate;
                    bestDayIdx = idx;
                }
                if (rate < minRate) {
                    minRate = rate;
                    worstDayIdx = idx;
                }
            }
        });

        // Compute Month-over-Month averages
        const today = new Date();
        const startOfThisMonth = startOfMonth(today);
        const thisMonthInterval = eachDayOfInterval({ start: startOfThisMonth, end: today });
        const startOfPriorMonth = startOfMonth(subDays(startOfThisMonth, 5));
        const endOfPriorMonth = endOfMonth(startOfPriorMonth);
        const priorMonthInterval = eachDayOfInterval({ start: startOfPriorMonth, end: endOfPriorMonth });

        let thisMonthCount = 0;
        let priorMonthCount = 0;

        entries.forEach((e) => {
            if (!filteredTaskIds.includes(e.task_id)) return;
            const dateObj = parseISO(e.entry_date);
            if (isWithinInterval(dateObj, { start: startOfThisMonth, end: today })) {
                thisMonthCount += 1;
            } else if (isWithinInterval(dateObj, { start: startOfPriorMonth, end: endOfPriorMonth })) {
                priorMonthCount += 1;
            }
        });

        const expectedThisMonth = thisMonthInterval.length * filteredTasks.length;
        const expectedPriorMonth = priorMonthInterval.length * filteredTasks.length;

        const rateThis = expectedThisMonth > 0 ? Math.round((thisMonthCount / expectedThisMonth) * 100) : 0;
        const ratePrior = expectedPriorMonth > 0 ? Math.round((priorMonthCount / expectedPriorMonth) * 100) : 0;
        const diff = rateThis - ratePrior;

        return {
            bestDay: dayNames[bestDayIdx],
            bestDayRate: Math.round((maxRate === -1 ? 0 : maxRate) * 100),
            worstDay: dayNames[worstDayIdx],
            worstDayRate: Math.round((minRate === 2.0 ? 0 : minRate) * 105),
            rateThisMonth: rateThis,
            ratePriorMonth: ratePrior,
            change: diff,
        };
    }, [filteredTasks, filteredTaskIds, entries]);

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
                    {(['7', '30', 'month', '90'] as RangeOption[]).map((opt) => (
                        <button
                            key={opt}
                            onClick={() => setRange(opt)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none ${range === opt ? 'bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            {opt === '7' ? '7D' : opt === '30' ? '30D' : opt === 'month' ? 'Month' : '90D'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex flex-wrap gap-1.5 p-1.5 bg-slate-900/30 border border-slate-900 rounded-2xl w-fit">
                {['All', 'General', 'Work', 'Health', 'Personal'].map((cat) => (
                    <button
                        key={cat}
                        onClick={() => setSelectedCategoryFilter(cat)}
                        className={`px-3.5 py-1 rounded-xl text-xs font-semibold cursor-pointer select-none transition-all ${selectedCategoryFilter === cat
                                ? 'bg-gradient-to-tr from-violet-600 to-indigo-600 border border-violet-500 text-white shadow'
                                : 'text-slate-400 border border-transparent hover:text-slate-205 hover:border-slate-800'
                            }`}
                    >
                        {cat}
                    </button>
                ))}
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
            ) : filteredTasks.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-900/10 border border-slate-900 rounded-2xl min-h-[300px]">
                    <h3 className="text-lg font-semibold text-white">No category data</h3>
                    <p className="text-sm text-slate-500 max-w-sm mt-1">
                        No tasks created in category "{selectedCategoryFilter}" yet.
                    </p>
                </div>
            ) : (
                <>
                    {/* behavioral insights cards */}
                    {behavioralInsights && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* MoM Performance Comparison */}
                            <div className="bg-slate-900/30 border border-slate-900 p-5 rounded-2xl backdrop-blur relative overflow-hidden flex flex-col justify-between min-h-[120px]">
                                <div>
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">MoM Activity Compare</span>
                                    <div className="flex items-baseline gap-2 mt-1">
                                        <span className="text-2xl font-extrabold text-white">{behavioralInsights.rateThisMonth}%</span>
                                        <span className="text-xs text-slate-400">vs last month ({behavioralInsights.ratePriorMonth}%)</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 mt-3">
                                    {behavioralInsights.change >= 0 ? (
                                        <div className="flex items-center text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-lg">
                                            <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                                            <span>+{behavioralInsights.change}% increase</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center text-xs text-red-400 font-semibold bg-red-500/10 px-2 py-0.5 rounded-lg">
                                            <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                                            <span>{behavioralInsights.change}% decrease</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Best Completion Day */}
                            <div className="bg-slate-900/30 border border-slate-900 p-5 rounded-2xl backdrop-blur relative overflow-hidden flex flex-col justify-between min-h-[120px]">
                                <div>
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Peak Routine Day</span>
                                    <div className="flex items-baseline gap-2 mt-1">
                                        <span className="text-2xl font-extrabold text-white">{behavioralInsights.bestDay}</span>
                                    </div>
                                </div>
                                <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                                    <div className="flex items-center text-violet-400 font-bold bg-violet-500/10 px-2 py-0.5 rounded-lg">
                                        <TrendingUp className="w-3.5 h-3.5 mr-1" />
                                        <span>{behavioralInsights.bestDayRate}% Success</span>
                                    </div>
                                    <span className="text-[10px] text-slate-500">Peak Completion Rate</span>
                                </div>
                            </div>

                            {/* Worst Completion Day/Insight */}
                            <div className="bg-slate-900/30 border border-slate-900 p-5 rounded-2xl backdrop-blur relative overflow-hidden flex flex-col justify-between min-h-[120px]">
                                <div>
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Weakest Routine Day</span>
                                    <div className="flex items-baseline gap-2 mt-1">
                                        <span className="text-2xl font-extrabold text-slate-300">{behavioralInsights.worstDay}</span>
                                    </div>
                                </div>
                                <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                                    <div className="flex items-center text-amber-500 font-bold bg-amber-500/10 px-2 py-0.5 rounded-lg">
                                        <Sparkles className="w-3.5 h-3.5 mr-1" />
                                        <span>{behavioralInsights.worstDayRate}% Score</span>
                                    </div>
                                    <span className="text-[10px] text-slate-500">Need Focus Here</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* GitHub style dynamic calendar contribution heatmap (last 26 weeks) */}
                    <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-5 sm:p-6 backdrop-blur">
                        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-violet-400" />
                            Routine Completion Frequency (Last 6 Months)
                        </h3>

                        {/* Calendar Heatmap grid container */}
                        <div className="flex gap-[3px] overflow-x-auto pb-2 scrollbar-thin max-w-full">
                            {/* Day of Week Labels */}
                            <div className="flex flex-col justify-between text-[9px] font-bold text-slate-500 pr-2 py-[2px] h-[103px] select-none pointer-events-none sticky left-0 bg-slate-950/60 backdrop-blur-sm z-10">
                                <span>Sun</span>
                                <span>Tue</span>
                                <span>Thu</span>
                                <span>Sat</span>
                            </div>

                            <div className="flex gap-[3.5px]">
                                {heatmapWeeks.map((week, wIdx) => (
                                    <div key={wIdx} className="flex flex-col gap-[3.5px]">
                                        {week.map((day, dIdx) => {
                                            const today = new Date();
                                            const isFuture = day > today;
                                            const dateStr = format(day, 'yyyy-MM-dd');

                                            // Compute completions on this day for the selected category filter
                                            const completedOnDay = entries.filter(
                                                (e) => filteredTaskIds.includes(e.task_id) && e.entry_date === dateStr && e.completed
                                            ).length;

                                            const totalTasksOnDay = filteredTasks.length;
                                            const progress = totalTasksOnDay > 0 ? (completedOnDay / totalTasksOnDay) * 100 : 0;

                                            // GitHub Contribution styling colors
                                            let cellColor = 'bg-slate-900/40 border border-slate-950/80';
                                            if (!isFuture && completedOnDay > 0) {
                                                if (progress <= 25) {
                                                    cellColor = 'bg-violet-955 bg-opacity-60 border border-violet-900/30';
                                                } else if (progress <= 50) {
                                                    cellColor = 'bg-indigo-900/80 border border-indigo-800/40';
                                                } else if (progress <= 75) {
                                                    cellColor = 'bg-indigo-700 border border-indigo-600';
                                                } else {
                                                    cellColor = 'bg-violet-500 border border-violet-400';
                                                }
                                            }

                                            return (
                                                <div
                                                    key={dIdx}
                                                    title={`${format(day, 'MMM d, yyyy')}: ${completedOnDay}/${totalTasksOnDay} tasks completed (${Math.round(progress)}%)`}
                                                    className={`w-[11px] h-[11px] rounded-[2.5px] cursor-pointer transition-all hover:scale-135 hover:z-20 ${cellColor} ${isFuture ? 'opacity-10 pointer-events-none' : ''}`}
                                                />
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="flex items-center gap-1.5 justify-end text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-3 select-none">
                            <span>Less</span>
                            <div className="w-[10px] h-[10px] rounded-[2px] bg-slate-900/40 border border-slate-950" />
                            <div className="w-[10px] h-[10px] rounded-[2px] bg-violet-955 bg-indigo-950 border border-violet-900/30" />
                            <div className="w-[10px] h-[10px] rounded-[2px] bg-indigo-900/80 border border-indigo-800/40" />
                            <div className="w-[10px] h-[10px] rounded-[2px] bg-indigo-700 border border-indigo-600" />
                            <div className="w-[10px] h-[10px] rounded-[2px] bg-violet-500 border border-violet-400" />
                            <span>More</span>
                        </div>
                    </div>

                    {/* Daily completion rate across month chart */}
                    <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-4 sm:p-6 backdrop-blur">
                        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                            <CalendarIcon className="w-4 h-4 text-violet-400" />
                            Overall Daily Completion % ({format(currentMonthDate, 'MMMM yyyy')})
                        </h3>
                        <div className="h-64 w-full text-xs font-semibold">
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
                                    <RechartsTooltip
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
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">{taskStat.category}</span>
                                    <div className="flex items-center gap-3.5 mt-2">
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

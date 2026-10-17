'use client';

/* eslint-disable @next/next/no-img-element -- small static badge icons */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
    format,
    subDays,
    subMonths,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    parseISO,
    startOfWeek,
    addDays,
} from 'date-fns';
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
} from 'recharts';
import { Flame, Award, Percent, Calendar as CalendarIcon, Loader2, ArrowUpRight, ArrowDownRight, Sparkles, TrendingUp, ShieldAlert } from 'lucide-react';
import type { WeeklyReportPayload, WeeklyReportResponse } from '@/lib/ai-schemas';
import type { Task } from '@/lib/types';
import { toDateStr } from '@/lib/dates';
import { buildCategoryOptions, matchesCategory, ALL_CATEGORIES } from '@/lib/categories';
import type { Database } from '@/lib/database.types';
import { MILESTONES } from '@/lib/milestones';
import CategoryFilter from '@/components/CategoryFilter';
import ErrorBanner from '@/components/ErrorBanner';
import LoadingState from '@/components/LoadingState';

// Per-habit streaks over full history, computed in the database by get_task_streak_stats()
type StreakStats = Database['public']['Functions']['get_task_streak_stats']['Returns'][number];

interface Completion {
    task_id: string;
    entry_date: string;
}

type RangeOption = '7' | '30' | 'month' | '90';

// The heatmap is the widest window any widget needs (it also covers the 90D range and last month)
const HEATMAP_WEEKS = 26;
// Supabase caps a single response (1000 rows by default), so completions are fetched in pages
const PAGE_SIZE = 1000;

// Shared card surface, light + dark
const CARD = 'bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-900 rounded-2xl backdrop-blur';

const AI_REPORT_SECTIONS: { key: keyof WeeklyReportResponse; title: string; className: string }[] = [
    { key: 'topWin', title: '🎯 Top Win of the Week', className: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' },
    { key: 'riskAlert', title: '⚠️ Streak Loss Risk Alert', className: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400' },
    { key: 'customTip', title: '💡 Custom Tip for Next Week', className: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400' },
];

interface InsightCardProps {
    label: string;
    value: string;
    detail?: string;
    chip: { icon?: React.ReactNode; text: string; className: string };
    note?: string;
}

function InsightCard({ label, value, detail, chip, note }: InsightCardProps) {
    return (
        <div className={`${CARD} p-3.5 sm:p-5 flex flex-col justify-between min-h-[90px] sm:min-h-[120px]`}>
            <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{label}</span>
                <div className="flex items-baseline gap-2 mt-0.5 sm:mt-1">
                    <span className="text-xl sm:text-2xl font-extrabold text-slate-800 dark:text-white">{value}</span>
                    {detail && <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">{detail}</span>}
                </div>
            </div>
            <div className="mt-2 sm:mt-3 flex items-center justify-between">
                <div className={`flex items-center font-semibold px-2 py-0.5 rounded-lg text-[11px] sm:text-xs ${chip.className}`}>
                    {chip.icon}
                    <span>{chip.text}</span>
                </div>
                {note && <span className="text-[10px] text-slate-500">{note}</span>}
            </div>
        </div>
    );
}

// Heatmap intensity levels: none, <=25%, <=50%, <=75%, >75%
const HEATMAP_LEVELS = [
    'bg-slate-100 border border-slate-200 dark:bg-slate-900/40 dark:border-slate-950/80',
    'bg-violet-200 border border-violet-300/60 dark:bg-indigo-950 dark:border-violet-900/30',
    'bg-violet-300 border border-violet-400/60 dark:bg-indigo-900/80 dark:border-indigo-800/40',
    'bg-violet-500 border border-violet-500 dark:bg-indigo-700 dark:border-indigo-600',
    'bg-violet-700 border border-violet-700 dark:bg-violet-500 dark:border-violet-400',
];

function heatmapLevel(completed: number, progress: number): number {
    if (completed === 0) return 0;
    if (progress <= 25) return 1;
    if (progress <= 50) return 2;
    if (progress <= 75) return 3;
    return 4;
}

export default function AnalyticsView({ userId }: { userId: string }) {
    const supabase = useMemo(() => createClient(), []);

    // "Today" is fixed for the lifetime of the page so all widgets agree
    const [today] = useState<Date>(() => new Date());
    const todayStr = toDateStr(today);

    // States
    const [tasks, setTasks] = useState<Task[]>([]);
    const [completions, setCompletions] = useState<Completion[]>([]);
    // null = server-side stats unavailable (migration not applied), use the client fallback
    const [streaksByTask, setStreaksByTask] = useState<Record<string, StreakStats>>({});
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [range, setRange] = useState<RangeOption>('30');

    // Analytics Filters
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>(ALL_CATEGORIES);

    // AI Performance Report State
    const [aiReport, setAiReport] = useState<WeeklyReportResponse | null>(null);
    const [aiReportError, setAiReportError] = useState<string | null>(null);
    const [aiReportLoading, setAiReportLoading] = useState(false);

    const fetchWeeklyReport = async () => {
        if (aiReportLoading) return;
        setAiReportLoading(true);
        setAiReportError(null);
        try {
            const res = await fetch('/api/ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'weekly_report',
                    payload: buildWeeklyReportPayload(),
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.topWin) {
                setAiReport(data);
            } else {
                setAiReportError(data.error || 'Could not generate the report. Please try again.');
            }
        } catch (e) {
            console.error('Error fetching AI report:', e);
            setAiReportError('Could not reach the AI service. Please try again.');
        } finally {
            setAiReportLoading(false);
        }
    };

    // Sunday-aligned start of the heatmap grid; also the start of the completions window
    const windowStart = useMemo(
        () => startOfWeek(subDays(today, HEATMAP_WEEKS * 7), { weekStartsOn: 0 }),
        [today]
    );

    // Fetch tasks, server-side streak stats and the completions window
    useEffect(() => {
        let cancelled = false;

        async function fetchData() {
            try {
                setLoading(true);
                setLoadError(null);

                const [tasksResult, statsResult] = await Promise.all([
                    supabase.from('tasks').select('*').eq('archived', false),
                    supabase.rpc('get_task_streak_stats', { p_today: todayStr }),
                ]);

                if (tasksResult.error) throw tasksResult.error;

                // Page until an empty page: works whatever the server's max-rows setting is
                const rows: Completion[] = [];
                for (;;) {
                    const { data, error } = await supabase
                        .from('entries')
                        .select('task_id, entry_date')
                        .eq('user_id', userId)
                        .eq('completed', true)
                        .gte('entry_date', toDateStr(windowStart))
                        .lte('entry_date', todayStr)
                        .order('entry_date', { ascending: true })
                        .order('task_id', { ascending: true })
                        .range(rows.length, rows.length + PAGE_SIZE - 1);

                    if (error) throw error;
                    if (!data || data.length === 0) break;
                    rows.push(...data);
                }

                if (cancelled) return;

                setTasks(tasksResult.data || []);
                setCompletions(rows);

                if (statsResult.error) throw statsResult.error;
                setStreaksByTask(Object.fromEntries((statsResult.data || []).map((row) => [row.task_id, row])));
            } catch (err) {
                if (cancelled) return;
                console.error('Error fetching analytics data:', err);
                setLoadError('Could not load analytics. Please refresh to try again.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        fetchData();

        return () => {
            cancelled = true;
        };
    }, [userId, supabase, windowStart, todayStr]);

    const categoryOptions = useMemo(() => buildCategoryOptions(tasks), [tasks]);
    const filteredTasks = useMemo(
        () => tasks.filter((t) => matchesCategory(t, selectedCategoryFilter)),
        [tasks, selectedCategoryFilter]
    );

    // task_id -> ascending completion dates (rows arrive sorted by date; entries are unique per task/date)
    const completionDatesByTask = useMemo(() => {
        const map = new Map<string, string[]>();
        for (const c of completions) {
            const list = map.get(c.task_id);
            if (list) list.push(c.entry_date);
            else map.set(c.task_id, [c.entry_date]);
        }
        return map;
    }, [completions]);

    // date -> task ids completed that day
    const completionsByDate = useMemo(() => {
        const map = new Map<string, Set<string>>();
        for (const c of completions) {
            const set = map.get(c.entry_date);
            if (set) set.add(c.task_id);
            else map.set(c.entry_date, new Set([c.task_id]));
        }
        return map;
    }, [completions]);

    // First day each habit counts toward rates: its creation day, or earlier if days were back-filled
    const activeFrom = useMemo(() => {
        const map = new Map<string, string>();
        for (const t of tasks) {
            const created = toDateStr(parseISO(t.created_at));
            const firstDone = streaksByTask[t.id]?.first_completed ?? completionDatesByTask.get(t.id)?.[0];
            map.set(t.id, firstDone && firstDone < created ? firstDone : created);
        }
        return map;
    }, [tasks, streaksByTask, completionDatesByTask]);

    // For one day: how many filtered habits existed, and how many of those were completed
    const dayTotals = useCallback((dateStr: string) => {
        const done = completionsByDate.get(dateStr);
        let active = 0;
        let completed = 0;
        for (const t of filteredTasks) {
            if ((activeFrom.get(t.id) ?? dateStr) > dateStr) continue;
            active += 1;
            if (done?.has(t.id)) completed += 1;
        }
        return { active, completed };
    }, [completionsByDate, filteredTasks, activeFrom]);

    // Start date for selected range filter (ends today)
    const rangeStartStr = useMemo(() => {
        if (range === '7') return toDateStr(subDays(today, 6));
        if (range === '30') return toDateStr(subDays(today, 29));
        if (range === '90') return toDateStr(subDays(today, 89));
        return toDateStr(startOfMonth(today));
    }, [range, today]);

    // Streaks and completion rate per task (filtered by category)
    const stats = useMemo(() => {
        return filteredTasks.map((task) => {
            const streaks = streaksByTask[task.id];

            // Only count days since the habit existed, so a new habit isn't penalised for days before it was created
            const taskStart = activeFrom.get(task.id) ?? rangeStartStr;
            const fromStr = taskStart > rangeStartStr ? taskStart : rangeStartStr;
            const trackedDays = fromStr > todayStr
                ? []
                : eachDayOfInterval({ start: parseISO(fromStr), end: parseISO(todayStr) }).map(toDateStr);

            const doneDates = new Set(completionDatesByTask.get(task.id) ?? []);
            const completionsInRange = trackedDays.filter((d) => doneDates.has(d)).length;
            const rate = trackedDays.length ? Math.round((completionsInRange / trackedDays.length) * 100) : 0;

            return {
                id: task.id,
                name: task.name,
                category: task.category || 'General',
                currentStreak: streaks?.current_streak ?? 0,
                longestStreak: streaks?.longest_streak ?? 0,
                rate,
                trackedDays: trackedDays.length,
            };
        });
    }, [filteredTasks, streaksByTask, activeFrom, rangeStartStr, todayStr, completionDatesByTask]);

    // Daily completion % for the current month; future days and days with no habits yet are gaps
    const chartData = useMemo(() => {
        if (filteredTasks.length === 0) return [];

        return eachDayOfInterval({ start: startOfMonth(today), end: endOfMonth(today) }).map((day) => {
            const dateStr = toDateStr(day);
            const dateLabel = format(day, 'MMM d');
            if (dateStr > todayStr) return { dateLabel, rate: null, completed: null };

            const { active, completed } = dayTotals(dateStr);
            return {
                dateLabel,
                rate: active ? Math.round((completed / active) * 100) : null,
                completed,
            };
        });
    }, [filteredTasks, today, todayStr, dayTotals]);

    // GitHub-style contribution calendar (last 26 weeks), Sunday-aligned columns
    const heatmapWeeks = useMemo(() => {
        const allGridDays = eachDayOfInterval({ start: windowStart, end: today });
        const lastDay = allGridDays[allGridDays.length - 1];
        // Pad the final column out to Saturday
        for (let d = addDays(lastDay, 1); allGridDays.length % 7 !== 0; d = addDays(d, 1)) {
            allGridDays.push(d);
        }

        const weeks: { dateStr: string; label: string; isFuture: boolean; active: number; completed: number; progress: number }[][] = [];
        for (let i = 0; i < allGridDays.length; i += 7) {
            weeks.push(allGridDays.slice(i, i + 7).map((day) => {
                const dateStr = toDateStr(day);
                const isFuture = dateStr > todayStr;
                const { active, completed } = isFuture ? { active: 0, completed: 0 } : dayTotals(dateStr);
                return {
                    dateStr,
                    label: format(day, 'MMM d, yyyy'),
                    isFuture,
                    active,
                    completed,
                    progress: active > 0 ? (completed / active) * 100 : 0,
                };
            }));
        }
        return weeks;
    }, [windowStart, today, todayStr, dayTotals]);

    // Weekday patterns and month-over-month change, over the loaded window (last ~6 months)
    const behavioralInsights = useMemo(() => {
        if (filteredTasks.length === 0 || completions.length === 0) return null;

        const byWeekday = Array.from({ length: 7 }, () => ({ completed: 0, expected: 0 }));
        const thisMonth = { completed: 0, expected: 0 };
        const priorMonth = { completed: 0, expected: 0 };

        const thisMonthStart = toDateStr(startOfMonth(today));
        const priorMonthDate = subMonths(today, 1);
        const priorStart = toDateStr(startOfMonth(priorMonthDate));
        const priorEnd = toDateStr(endOfMonth(priorMonthDate));

        for (const day of eachDayOfInterval({ start: windowStart, end: today })) {
            const dateStr = toDateStr(day);
            const { active, completed } = dayTotals(dateStr);
            if (active === 0) continue;

            byWeekday[day.getDay()].completed += completed;
            byWeekday[day.getDay()].expected += active;

            if (dateStr >= thisMonthStart) {
                thisMonth.completed += completed;
                thisMonth.expected += active;
            } else if (dateStr >= priorStart && dateStr <= priorEnd) {
                priorMonth.completed += completed;
                priorMonth.expected += active;
            }
        }

        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        let bestDayIdx = -1;
        let worstDayIdx = -1;
        let maxRate = -1;
        let minRate = Infinity;

        byWeekday.forEach(({ completed, expected }, idx) => {
            if (expected === 0) return;
            const rate = completed / expected;
            if (rate > maxRate) {
                maxRate = rate;
                bestDayIdx = idx;
            }
            if (rate < minRate) {
                minRate = rate;
                worstDayIdx = idx;
            }
        });

        if (bestDayIdx === -1) return null;

        const rateThisMonth = thisMonth.expected > 0 ? Math.round((thisMonth.completed / thisMonth.expected) * 100) : 0;
        // null when no habits existed last month, so we don't claim a misleading change
        const ratePriorMonth = priorMonth.expected > 0 ? Math.round((priorMonth.completed / priorMonth.expected) * 100) : null;

        return {
            bestDay: dayNames[bestDayIdx],
            bestDayRate: Math.round(maxRate * 100),
            worstDay: dayNames[worstDayIdx],
            worstDayRate: Math.round(minRate * 100),
            rateThisMonth,
            ratePriorMonth,
            change: ratePriorMonth === null ? null : rateThisMonth - ratePriorMonth,
        };
    }, [filteredTasks, completions, today, windowStart, dayTotals]);

    // Real numbers for the AI weekly report (current category filter): this week vs the week before
    const buildWeeklyReportPayload = (): WeeklyReportPayload => {
        const last7 = Array.from({ length: 7 }, (_, i) => toDateStr(subDays(today, i)));
        const prev7 = Array.from({ length: 7 }, (_, i) => toDateStr(subDays(today, i + 7)));

        const habits = filteredTasks.slice(0, 50).map((task) => {
            const done = new Set(completionDatesByTask.get(task.id) ?? []);
            const from = activeFrom.get(task.id) ?? todayStr;
            // Only days on which the habit existed count as tracked
            const trackedLast7 = last7.filter((d) => d >= from);
            const trackedPrev7 = prev7.filter((d) => d >= from);
            const streaks = streaksByTask[task.id];

            return {
                name: task.name.slice(0, 120),
                category: (task.category || 'General').slice(0, 40),
                currentStreak: streaks?.current_streak ?? 0,
                longestStreak: streaks?.longest_streak ?? 0,
                completedLast7: trackedLast7.filter((d) => done.has(d)).length,
                trackedLast7: trackedLast7.length,
                completedPrev7: trackedPrev7.filter((d) => done.has(d)).length,
                trackedPrev7: trackedPrev7.length,
            };
        });

        return {
            categoryFilter: selectedCategoryFilter.slice(0, 40),
            habits,
            bestWeekday: behavioralInsights?.bestDay ?? null,
            worstWeekday: behavioralInsights?.worstDay ?? null,
        };
    };

    return (
        <div className="flex-1 flex flex-col gap-3 sm:gap-6">
            {/* Sub header and Range controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-900 rounded-2xl backdrop-blur">
                <div>
                    <h2 className="text-lg sm:text-2xl font-bold text-slate-800 dark:text-white tracking-tight">
                        Habit Analytics
                    </h2>
                    <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Visualize your routines, streaks, and completion rates
                    </p>
                </div>

                {/* Filter ranges */}
                <div className="flex bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-1 self-start sm:self-auto">
                    {(['7', '30', 'month', '90'] as RangeOption[]).map((opt) => (
                        <button
                            key={opt}
                            onClick={() => setRange(opt)}
                            aria-pressed={range === opt}
                            className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all cursor-pointer select-none ${range === opt ? 'bg-linear-to-tr from-violet-600 to-indigo-600 text-white shadow' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                        >
                            {opt === '7' ? '7D' : opt === '30' ? '30D' : opt === 'month' ? 'Month' : '90D'}
                        </button>
                    ))}
                </div>
            </div>

            <CategoryFilter options={categoryOptions} selected={selectedCategoryFilter} onSelect={setSelectedCategoryFilter} />

            {loadError && <ErrorBanner message={loadError} />}

            {loading ? (
                <LoadingState label="Analyzing habits..." />
            ) : loadError ? null : tasks.length === 0 ? (
                <div className={`${CARD} flex-1 flex flex-col items-center justify-center p-12 text-center min-h-[300px]`}>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white">No data to display</h3>
                    <p className="text-sm text-slate-500 max-w-sm mt-1">
                        Create tasks and record completions in Weekly Tracker first.
                    </p>
                </div>
            ) : filteredTasks.length === 0 ? (
                <div className={`${CARD} flex-1 flex flex-col items-center justify-center p-12 text-center min-h-[300px]`}>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white">No category data</h3>
                    <p className="text-sm text-slate-500 max-w-sm mt-1">
                        No tasks created in category &quot;{selectedCategoryFilter}&quot; yet.
                    </p>
                </div>
            ) : (
                <>
                    {/* Weekly AI Performance Report Section */}
                    <div className="bg-linear-to-r from-violet-100 via-white to-indigo-100 dark:from-violet-900/30 dark:via-slate-900/40 dark:to-indigo-900/30 border border-violet-500/20 p-4 sm:p-5 rounded-2xl backdrop-blur space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-linear-to-tr from-violet-600 to-indigo-600 text-white shadow">
                                    <Sparkles className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-white">Weekly AI Performance Report</h3>
                                    <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">
                                        AI summary of this week vs last week{selectedCategoryFilter !== 'All' ? ` (${selectedCategoryFilter})` : ''}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={fetchWeeklyReport}
                                disabled={aiReportLoading}
                                className="self-start sm:self-auto bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl disabled:opacity-40 transition-all flex items-center gap-1.5 cursor-pointer shadow"
                            >
                                {aiReportLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                {aiReport ? 'Refresh Report' : 'Generate AI Report'}
                            </button>
                        </div>

                        {aiReportError && (
                            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 px-3 py-2 rounded-xl text-xs font-semibold">
                                <ShieldAlert className="w-4 h-4 shrink-0" />
                                <span>{aiReportError}</span>
                            </div>
                        )}

                        {aiReport && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                                {AI_REPORT_SECTIONS.map(({ key, title, className }) => (
                                    <div key={key} className={`p-3.5 border rounded-xl space-y-1 ${className}`}>
                                        <span className="text-[11px] font-extrabold uppercase tracking-wider">{title}</span>
                                        <p className="text-xs text-slate-700 dark:text-slate-200 font-semibold">{aiReport[key]}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Behavioral insight cards */}
                    {behavioralInsights && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
                            <InsightCard
                                label="MoM Activity Compare"
                                value={`${behavioralInsights.rateThisMonth}%`}
                                detail={behavioralInsights.ratePriorMonth === null ? 'this month' : `vs last month (${behavioralInsights.ratePriorMonth}%)`}
                                chip={
                                    behavioralInsights.change === null
                                        ? { text: 'No habits tracked last month', className: 'text-slate-500 dark:text-slate-400 bg-slate-500/10' }
                                        : behavioralInsights.change >= 0
                                            ? { icon: <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />, text: `+${behavioralInsights.change}% increase`, className: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' }
                                            : { icon: <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />, text: `${behavioralInsights.change}% decrease`, className: 'text-red-600 dark:text-red-400 bg-red-500/10' }
                                }
                            />
                            <InsightCard
                                label="Peak Routine Day"
                                value={behavioralInsights.bestDay}
                                chip={{ icon: <TrendingUp className="w-3.5 h-3.5 mr-1" />, text: `${behavioralInsights.bestDayRate}% Success`, className: 'text-violet-600 dark:text-violet-400 bg-violet-500/10' }}
                                note="Last 6 months"
                            />
                            <InsightCard
                                label="Weakest Routine Day"
                                value={behavioralInsights.worstDay}
                                chip={{ icon: <Sparkles className="w-3.5 h-3.5 mr-1" />, text: `${behavioralInsights.worstDayRate}% Score`, className: 'text-amber-600 dark:text-amber-500 bg-amber-500/10' }}
                                note="Need Focus Here"
                            />
                        </div>
                    )}

                    {/* GitHub style dynamic calendar contribution heatmap (last 26 weeks) */}
                    <div className={`${CARD} p-5 sm:p-6`}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-violet-500 dark:text-violet-400" />
                                Routine Completion Frequency (Last 6 Months)
                            </h3>
                            <span className="sm:hidden text-[10px] text-violet-600 dark:text-violet-400 font-bold bg-violet-500/10 px-2 py-0.5 rounded-full">
                                Swipe ➔
                            </span>
                        </div>

                        {/* Calendar Heatmap grid container */}
                        <div className="flex gap-[3px] overflow-x-auto pb-2 max-w-full">
                            {/* Day of Week Labels */}
                            <div className="flex flex-col justify-between text-[9px] font-bold text-slate-500 pr-2 py-[2px] h-[103px] select-none pointer-events-none sticky left-0 bg-white/80 dark:bg-slate-950/60 backdrop-blur-sm z-10">
                                <span>Sun</span>
                                <span>Tue</span>
                                <span>Thu</span>
                                <span>Sat</span>
                            </div>

                            <div className="flex gap-[3.5px]">
                                {heatmapWeeks.map((week, wIdx) => (
                                    <div key={wIdx} className="flex flex-col gap-[3.5px]">
                                        {week.map((cell) => (
                                            <div
                                                key={cell.dateStr}
                                                title={cell.isFuture
                                                    ? cell.label
                                                    : `${cell.label}: ${cell.completed}/${cell.active} tasks completed (${Math.round(cell.progress)}%)`}
                                                className={`w-[11px] h-[11px] rounded-[2.5px] cursor-pointer transition-all hover:scale-135 hover:z-20 ${HEATMAP_LEVELS[cell.isFuture ? 0 : heatmapLevel(cell.completed, cell.progress)]} ${cell.isFuture ? 'opacity-10 pointer-events-none' : ''}`}
                                            />
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="flex items-center gap-1.5 justify-end text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-3 select-none">
                            <span>Less</span>
                            {HEATMAP_LEVELS.map((level) => (
                                <div key={level} className={`w-[10px] h-[10px] rounded-[2px] ${level}`} />
                            ))}
                            <span>More</span>
                        </div>
                    </div>

                    {/* Daily completion rate across month chart */}
                    <div className={`${CARD} p-4 sm:p-6`}>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                            <CalendarIcon className="w-4 h-4 text-violet-500 dark:text-violet-400" />
                            Overall Daily Completion % ({format(today, 'MMMM yyyy')})
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
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                                    <XAxis dataKey="dateLabel" stroke="var(--chart-axis)" tickLine={false} />
                                    <YAxis domain={[0, 100]} stroke="var(--chart-axis)" tickLine={false} />
                                    <RechartsTooltip
                                        contentStyle={{
                                            backgroundColor: 'var(--chart-tooltip-bg)',
                                            borderColor: 'var(--chart-tooltip-border)',
                                            borderRadius: '8px',
                                            color: 'var(--chart-tooltip-text)',
                                        }}
                                        labelStyle={{ color: 'var(--chart-tooltip-label)' }}
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

                    {/* Milestone Badges Showcase in Analytics */}
                    <div className={`${CARD} p-5 sm:p-6`}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <Award className="w-4 h-4 text-amber-500" />
                                Streak Milestone Badges & Trophy Showcase
                            </h3>
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                                {stats.filter((s) => s.currentStreak >= 7 || s.longestStreak >= 7).length} / {stats.length} Habits Unlocked
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {MILESTONES.map((m) => {
                                const unlocked = stats.some((s) => s.currentStreak >= m.days || s.longestStreak >= m.days);
                                return (
                                    <div
                                        key={m.days}
                                        className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all ${unlocked ? `${m.card} ${m.text}` : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-900 text-slate-700 dark:text-slate-300 opacity-50'}`}
                                    >
                                        <img src={m.image} alt="" className="w-12 h-12 object-contain shrink-0" />
                                        <div>
                                            <div className="text-xs font-extrabold flex items-center gap-1">
                                                <span>{m.name} Badge</span>
                                                {unlocked && <span className={`text-[10px] px-1.5 py-0.5 rounded-md border ${m.chip}`}>Unlocked</span>}
                                            </div>
                                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">Reach {m.days} continuous days</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Cards metrics lists per task */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-4">
                        {stats.map((taskStat) => (
                            <div
                                key={taskStat.id}
                                className={`${CARD} p-3 sm:p-5 flex justify-between items-center group hover:border-slate-300 dark:hover:border-slate-800/80 transition-all shadow-sm dark:shadow-lg`}
                            >
                                <div className="flex flex-col gap-0.5 sm:gap-1 max-w-[70%]">
                                    <div className="flex items-center gap-1.5 sm:gap-2">
                                        <h4 className="font-semibold text-xs sm:text-sm text-slate-800 dark:text-slate-100 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors truncate">
                                            {taskStat.name}
                                        </h4>
                                        {MILESTONES.filter((m) => taskStat.currentStreak >= m.days).map((m) => (
                                            <img key={m.days} src={m.image} alt={`${m.name} badge`} title={`${m.name} badge unlocked`} className="w-3.5 h-3.5 sm:w-4 sm:h-4 object-contain" />
                                        ))}
                                    </div>
                                    <span className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-wider">{taskStat.category}</span>
                                    <div className="flex items-center gap-1.5 sm:gap-3.5 mt-1 sm:mt-2 flex-wrap">
                                        {/* Current Streak badge */}
                                        <div className="flex items-center text-[10px] sm:text-xs text-amber-600 dark:text-amber-500 font-bold bg-amber-500/10 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg">
                                            <Flame className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-0.5 sm:mr-1 fill-amber-500" />
                                            <span>{taskStat.currentStreak}d streak</span>
                                        </div>

                                        {/* Longest streak badge */}
                                        <div className="flex items-center text-[10px] sm:text-xs text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-500/10 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg">
                                            <Award className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-0.5 sm:mr-1" />
                                            <span>Best: {taskStat.longestStreak}d</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Progress Circle or Box */}
                                <div
                                    className="flex flex-col items-center justify-center p-2 sm:p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 min-w-[55px] sm:min-w-[70px] shrink-0"
                                    title={`Completed on ${taskStat.rate}% of the ${taskStat.trackedDays} day${taskStat.trackedDays !== 1 ? 's' : ''} this habit has existed in the selected range`}
                                >
                                    <Percent className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-violet-500 dark:text-violet-400 mb-0.5" />
                                    <span className="text-base sm:text-lg font-extrabold text-slate-800 dark:text-white tracking-tight leading-none">
                                        {taskStat.rate}%
                                    </span>
                                    <span className="text-[8px] sm:text-[9px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5 sm:mt-1">
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

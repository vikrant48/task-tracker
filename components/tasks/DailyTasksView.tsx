'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { addDays, format, parseISO, subDays } from 'date-fns';
import { Check, Plus, Trash2, CalendarArrowUp, Loader2, ListChecks, Repeat } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { DailyTask, Task } from '@/lib/types';
import { toDateStr } from '@/lib/dates';
import { ENTRY_CONFLICT_COLUMNS } from '@/lib/entries';
import { useDictation, appendSpoken } from '@/hooks/useDictation';
import MicButton from '@/components/MicButton';
import DictationError from '@/components/DictationError';
import ErrorBanner from '@/components/ErrorBanner';
import LoadingState from '@/components/LoadingState';
import HabitPicker from './HabitPicker';

const MAX_TITLE_LENGTH = 200;

// "Today" in the user's timezone, plus a counter that ticks whenever the app comes back to the
// foreground, so the list is re-read (habits may have been ticked meanwhile, or it may be past midnight)
function useForeground() {
    const [state, setState] = useState(() => ({ today: toDateStr(new Date()), tick: 0 }));
    useEffect(() => {
        const refresh = () => {
            if (document.visibilityState === 'hidden') return;
            setState((s) => ({ today: toDateStr(new Date()), tick: s.tick + 1 }));
        };
        document.addEventListener('visibilitychange', refresh);
        window.addEventListener('focus', refresh);
        return () => {
            document.removeEventListener('visibilitychange', refresh);
            window.removeEventListener('focus', refresh);
        };
    }, []);
    return state;
}

// One-off to-dos for today. Unfinished ones can be moved to tomorrow, where they show up
// as "From yesterday"; only today's list is ever shown. A task added from a habit stays in step with it:
// completing the task checks the habit in for that day, and ticking the habit anywhere else completes the task
// (a database trigger, see sync_habit_tasks in supabase/schema.sql).
export default function DailyTasksView({ userId }: { userId: string }) {
    const supabase = useMemo(() => createClient(), []);
    const { today, tick } = useForeground();
    const tomorrow = toDateStr(addDays(parseISO(today), 1));
    const yesterday = toDateStr(subDays(parseISO(today), 1));

    const [tasks, setTasks] = useState<DailyTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [adding, setAdding] = useState(false);
    const [habits, setHabits] = useState<Task[]>([]);
    const dictation = useDictation<'title'>();

    useEffect(() => {
        let cancelled = false;
        (async () => {
            // Spinner only on the first load; foreground refreshes update the list quietly
            if (tick === 0) setLoading(true);
            const [tasksRes, habitsRes] = await Promise.all([
                supabase.from('daily_tasks').select('*').eq('user_id', userId).eq('task_date', today).order('created_at', { ascending: true }),
                supabase.from('tasks').select('*').eq('archived', false).order('sort_order', { ascending: true }),
            ]);
            if (cancelled) return;
            if (tasksRes.error) {
                console.error('Error loading daily tasks:', tasksRes.error);
                setError('Could not load your tasks. Pull to refresh or try again.');
                setLoading(false);
                return;
            }
            setHabits(habitsRes.data || []);
            setTasks(tasksRes.data || []);
            setError(null);
            setLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, [supabase, userId, today, tick]);

    const insertTask = async (fields: { title: string; habit_id?: string; completed?: boolean }) => {
        setAdding(true);
        const { data, error: insertError } = await supabase
            .from('daily_tasks')
            .insert({ ...fields, task_date: today, user_id: userId, completed_at: fields.completed ? new Date().toISOString() : null })
            .select()
            .single();
        setAdding(false);

        if (insertError || !data) {
            console.error('Error adding task:', insertError);
            setError('Could not add the task. Please try again.');
            return false;
        }
        setTasks((prev) => [...prev, data]);
        return true;
    };

    const handleAdd = async (e: FormEvent) => {
        e.preventDefault();
        const clean = title.trim().slice(0, MAX_TITLE_LENGTH);
        if (!clean || adding) return;

        dictation.stop();
        if (await insertTask({ title: clean })) setTitle('');
    };

    // Add a habit as today's task, already done if the habit was checked in today
    const addFromHabit = async (habit: Task) => {
        const { data } = await supabase
            .from('entries')
            .select('completed')
            .eq('task_id', habit.id)
            .eq('user_id', userId)
            .eq('entry_date', today);
        await insertTask({ title: habit.name.slice(0, MAX_TITLE_LENGTH), habit_id: habit.id, completed: data?.[0]?.completed === true });
    };

    // Habits not already on today's list
    const linkedToday = new Set(tasks.map((t) => t.habit_id).filter(Boolean));
    const pickableHabits = habits.filter((h) => !linkedToday.has(h.id));
    const habitName = (id: string) => habits.find((h) => h.id === id)?.name;

    // Apply a change locally right away, then save; restore the previous list if the save fails
    const optimistic = useCallback(
        async (next: (prev: DailyTask[]) => DailyTask[], save: () => PromiseLike<{ error: unknown }>, failMessage: string) => {
            let previous: DailyTask[] = [];
            setTasks((prev) => {
                previous = prev;
                return next(prev);
            });
            const { error: saveError } = await save();
            if (saveError) {
                console.error(failMessage, saveError);
                setTasks(previous);
                setError(failMessage);
            }
        },
        []
    );

    const toggle = async (task: DailyTask) => {
        const completed = !task.completed;
        const completed_at = completed ? new Date().toISOString() : null;
        navigator.vibrate?.([15]);
        let saved = false;
        await optimistic(
            (prev) => prev.map((t) => (t.id === task.id ? { ...t, completed, completed_at } : t)),
            async () => {
                const result = await supabase.from('daily_tasks').update({ completed, completed_at }).eq('id', task.id);
                saved = !result.error;
                return result;
            },
            'Could not update the task. Your change was not saved.'
        );
        if (!saved || !task.habit_id) return;

        // Keep the linked habit in step for the task's day
        const { error: habitError } = await supabase.from('entries').upsert(
            { task_id: task.habit_id, user_id: userId, entry_date: task.task_date, completed, completed_at },
            { onConflict: ENTRY_CONFLICT_COLUMNS }
        );
        if (habitError) {
            console.error('Error updating linked habit:', habitError);
            setError(`The task was saved, but the habit "${habitName(task.habit_id) ?? task.title}" was not updated. Tick it on the Habits page.`);
        }
    };

    const moveToTomorrow = (task: DailyTask) =>
        optimistic(
            (prev) => prev.filter((t) => t.id !== task.id),
            () => supabase.from('daily_tasks').update({ task_date: tomorrow, moved_from: task.task_date }).eq('id', task.id),
            'Could not move the task. Please try again.'
        );

    const remove = (task: DailyTask) =>
        optimistic(
            (prev) => prev.filter((t) => t.id !== task.id),
            () => supabase.from('daily_tasks').delete().eq('id', task.id),
            'Could not delete the task. Please try again.'
        );

    const open = tasks.filter((t) => !t.completed);
    const done = tasks.filter((t) => t.completed);
    const pct = tasks.length ? Math.round((done.length / tasks.length) * 100) : 0;

    const movedLabel = (from: string) =>
        from === yesterday ? 'From yesterday' : `From ${format(parseISO(from), 'EEE, MMM d')}`;

    const row = (task: DailyTask) => (
        <li key={task.id} className={`flex items-center gap-2 pl-2 pr-1 py-1.5 rounded-2xl border transition-colors ${task.completed
            ? 'bg-slate-100/70 dark:bg-slate-900/30 border-transparent'
            : 'bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 shadow-sm'
            }`}>
            {/* Radio-style completion toggle */}
            <button
                type="button"
                role="checkbox"
                aria-checked={task.completed}
                aria-label={`Mark "${task.title}" as ${task.completed ? 'not done' : 'done'}`}
                onClick={() => toggle(task)}
                className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full cursor-pointer"
            >
                <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${task.completed
                    ? 'bg-linear-to-tr from-violet-600 to-indigo-600 border-violet-600 text-white'
                    : 'border-slate-300 dark:border-slate-600'
                    }`}>
                    {task.completed && <Check className="w-4 h-4 stroke-[3px]" />}
                </span>
            </button>

            <div className="flex-1 min-w-0 py-1">
                <p className={`text-base font-semibold wrap-break-word ${task.completed ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-800 dark:text-slate-100'}`}>
                    {task.title}
                </p>
                {task.habit_id && (
                    <span className="inline-flex items-center gap-1 mt-0.5 mr-2 text-xs font-bold text-violet-600 dark:text-violet-400">
                        <Repeat className="w-3.5 h-3.5" />
                        Habit
                    </span>
                )}
                {task.moved_from && (
                    <span className="inline-flex items-center gap-1 mt-0.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                        <CalendarArrowUp className="w-3.5 h-3.5" />
                        {movedLabel(task.moved_from)}
                    </span>
                )}
            </div>

            {!task.completed && (
                <button
                    type="button"
                    onClick={() => moveToTomorrow(task)}
                    aria-label={`Move "${task.title}" to tomorrow`}
                    title="Move to tomorrow"
                    className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl text-slate-400 hover:text-violet-600 active:bg-slate-100 dark:active:bg-slate-800 cursor-pointer"
                >
                    <CalendarArrowUp className="w-5 h-5" />
                </button>
            )}
            <button
                type="button"
                onClick={() => remove(task)}
                aria-label={`Delete "${task.title}"`}
                title="Delete"
                className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-500 active:bg-slate-100 dark:active:bg-slate-800 cursor-pointer"
            >
                <Trash2 className="w-5 h-5" />
            </button>
        </li>
    );

    return (
        <div className="flex-1 flex flex-col gap-4 sm:gap-6 w-full max-w-2xl mx-auto">
            <div>
                <h2 className="text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight">Today&apos;s Tasks</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">{format(parseISO(today), 'EEEE, MMMM d')}</p>
            </div>

            {/* Add a task: type or speak */}
            <form onSubmit={handleAdd} className="flex items-center gap-2">
                <div className="relative flex-1 min-w-0 flex items-center">
                    <input
                        type="text"
                        aria-label="New task"
                        enterKeyHint="done"
                        maxLength={MAX_TITLE_LENGTH}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Add a task for today…"
                        className="w-full min-w-0 h-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-4 pr-12 text-sm font-semibold text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    />
                    <div className="absolute right-1.5">
                        <MicButton
                            listening={dictation.listeningFor === 'title'}
                            onClick={() => dictation.toggle('title', (text) => setTitle((prev) => appendSpoken(prev, text).slice(0, MAX_TITLE_LENGTH)))}
                        />
                    </div>
                </div>
                <button
                    type="submit"
                    disabled={adding || !title.trim()}
                    className="h-12 shrink-0 px-4 sm:px-5 rounded-xl bg-linear-to-tr from-violet-600 to-indigo-600 text-white text-sm font-bold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
                >
                    {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Add
                </button>
            </form>
            {dictation.error && <div className="-mt-2 sm:-mt-4"><DictationError message={dictation.error} /></div>}

            {/* Or pick one of your habits: completing the task then checks the habit in too */}
            <div className="-mt-2 sm:-mt-4">
                <HabitPicker habits={pickableHabits} today={today} disabled={adding || loading} onPick={addFromHabit} />
            </div>

            {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

            {loading ? (
                <LoadingState label="Loading today's tasks..." />
            ) : tasks.length === 0 ? (
                <div className="flex flex-col items-center text-center py-12 px-6">
                    <span className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-4">
                        <ListChecks className="w-7 h-7 text-violet-500" />
                    </span>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">Nothing planned yet</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
                        Add what you want to get done today. Unfinished tasks can be moved to tomorrow.
                    </p>
                </div>
            ) : (
                <>
                    <div>
                        <div className="flex justify-between text-sm font-bold mb-2">
                            <span className="text-slate-700 dark:text-slate-200">{done.length} of {tasks.length} done</span>
                            <span className="text-violet-600 dark:text-violet-400">{pct}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Tasks completed">
                            <div className="h-full rounded-full bg-linear-to-r from-violet-600 to-emerald-500 transition-all duration-300" style={{ width: `${pct}%` }} />
                        </div>
                    </div>

                    {open.length > 0 && (
                        <section aria-label="To do">
                            <ul className="flex flex-col gap-2">{open.map(row)}</ul>
                        </section>
                    )}

                    {done.length > 0 && (
                        <section aria-label="Done">
                            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2 px-1">Done · {done.length}</h3>
                            <ul className="flex flex-col gap-2">{done.map(row)}</ul>
                        </section>
                    )}
                </>
            )}
        </div>
    );
}

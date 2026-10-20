'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { addDays, format, parseISO, subDays } from 'date-fns';
import { Check, Plus, Trash2, CalendarArrowUp, Loader2, ListChecks } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { DailyTask } from '@/lib/types';
import { toDateStr } from '@/lib/dates';
import { useDictation, appendSpoken } from '@/hooks/useDictation';
import MicButton from '@/components/MicButton';
import ErrorBanner from '@/components/ErrorBanner';
import LoadingState from '@/components/LoadingState';

const MAX_TITLE_LENGTH = 200;

// "Today" in the user's timezone; refreshed when the app comes back to the foreground after midnight
function useToday() {
    const [today, setToday] = useState(() => toDateStr(new Date()));
    useEffect(() => {
        const refresh = () => setToday(toDateStr(new Date()));
        document.addEventListener('visibilitychange', refresh);
        window.addEventListener('focus', refresh);
        return () => {
            document.removeEventListener('visibilitychange', refresh);
            window.removeEventListener('focus', refresh);
        };
    }, []);
    return today;
}

// One-off to-dos for today. Unfinished ones can be moved to tomorrow, where they show up
// as "From yesterday"; only today's list is ever shown.
export default function DailyTasksView({ userId }: { userId: string }) {
    const supabase = useMemo(() => createClient(), []);
    const today = useToday();
    const tomorrow = toDateStr(addDays(parseISO(today), 1));
    const yesterday = toDateStr(subDays(parseISO(today), 1));

    const [tasks, setTasks] = useState<DailyTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [adding, setAdding] = useState(false);
    const dictation = useDictation<'title'>();

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            const { data, error: fetchError } = await supabase
                .from('daily_tasks')
                .select('*')
                .eq('user_id', userId)
                .eq('task_date', today)
                .order('created_at', { ascending: true });
            if (cancelled) return;
            if (fetchError) {
                console.error('Error loading daily tasks:', fetchError);
                setError('Could not load your tasks. Pull to refresh or try again.');
            } else {
                setTasks(data || []);
                setError(null);
            }
            setLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, [supabase, userId, today]);

    const handleAdd = async (e: FormEvent) => {
        e.preventDefault();
        const clean = title.trim().slice(0, MAX_TITLE_LENGTH);
        if (!clean || adding) return;

        dictation.stop();
        setAdding(true);
        const { data, error: insertError } = await supabase
            .from('daily_tasks')
            .insert({ title: clean, task_date: today, user_id: userId })
            .select()
            .single();
        setAdding(false);

        if (insertError || !data) {
            console.error('Error adding task:', insertError);
            setError('Could not add the task. Please try again.');
            return;
        }
        setTasks((prev) => [...prev, data]);
        setTitle('');
    };

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

    const toggle = (task: DailyTask) => {
        const completed = !task.completed;
        const completed_at = completed ? new Date().toISOString() : null;
        navigator.vibrate?.([15]);
        optimistic(
            (prev) => prev.map((t) => (t.id === task.id ? { ...t, completed, completed_at } : t)),
            () => supabase.from('daily_tasks').update({ completed, completed_at }).eq('id', task.id),
            'Could not update the task. Your change was not saved.'
        );
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
                <p className={`text-base font-semibold break-words ${task.completed ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-800 dark:text-slate-100'}`}>
                    {task.title}
                </p>
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

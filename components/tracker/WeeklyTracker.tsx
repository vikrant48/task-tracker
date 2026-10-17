'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { startOfWeek, addDays, subDays } from 'date-fns';
import { CloudOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Entry, NewHabit, PartnerCheckIn, Task, TaskShare } from '@/lib/types';
import { dragTask, moveTask, ownedTaskIds, withOwnedSortOrder } from '@/lib/reorder';
import type { CoachHabitStat } from '@/lib/ai-schemas';
import { toDateStr } from '@/lib/dates';
import { buildCategoryOptions, matchesCategory, ALL_CATEGORIES } from '@/lib/categories';
import { applyOfflineQueue, nextSortOrder, sortByOrder } from '@/lib/entries';
import { readOfflineQueue } from '@/lib/offline-queue';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useCheckIns } from '@/hooks/useCheckIns';
import { useStreaks } from '@/hooks/useStreaks';
import { useReminders } from '@/hooks/useReminders';
import AICoachDrawer from '@/components/AICoachDrawer';
import CategoryFilter from '@/components/CategoryFilter';
import ErrorBanner from '@/components/ErrorBanner';
import LoadingState from '@/components/LoadingState';
import ViewModeSwitch from '@/components/ViewModeSwitch';
import TrackerHeader from './TrackerHeader';
import MobileDayView from './MobileDayView';
import WeekGrid from './WeekGrid';
import EmptyState from './EmptyState';
import AddHabitForm from './AddHabitForm';
import ArchivedHabits from './ArchivedHabits';
import RemoveHabitDialog from './RemoveHabitDialog';
import ShareHabitDialog from './ShareHabitDialog';
import MilestonesDialog from './MilestonesDialog';
import type { TaskEditing } from './types';
import type { MobileViewMode } from '@/lib/types';

const STARTER_HABITS: NewHabit[] = [
    { name: 'Drink 8 glasses of water', category: 'Health' },
    { name: 'Exercise for 30 minutes', category: 'Health' },
    { name: 'Read 10 pages of a book', category: 'Personal' },
    { name: 'Power focus session (1h)', category: 'Work' },
];

const SHARE_ERROR_MESSAGES: Record<string, string> = {
    not_found: 'This user email is not registered with FocusFlow.',
    self: 'You cannot share a habit with yourself.',
    exists: 'This habit is already shared with that user.',
    not_owner: 'Only the habit owner can share it.',
    unauthenticated: 'Your session has expired. Please sign in again.',
};

export default function WeeklyTracker({ userId }: { userId: string }) {
    const supabase = useMemo(() => createClient(), []);

    // Data
    const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
    const [tasks, setTasks] = useState<Task[]>([]);
    const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
    // Your own check-ins (editable) and, on shared habits, your partners' completed days (read-only)
    const [entries, setEntries] = useState<Entry[]>([]);
    const [partnerCheckIns, setPartnerCheckIns] = useState<PartnerCheckIn[]>([]);
    const [taskShares, setTaskShares] = useState<TaskShare[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const [error, setError] = useState<string | null>(null);

    // UI
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>(ALL_CATEGORIES);
    const [mobileViewMode, setMobileViewMode] = useState<MobileViewMode>('cards');
    const [addingTask, setAddingTask] = useState(false);
    const [taskPendingRemoval, setTaskPendingRemoval] = useState<Task | null>(null);
    const [sharingTaskId, setSharingTaskId] = useState<string | null>(null);
    const [showMilestones, setShowMilestones] = useState(false);
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [editingTaskName, setEditingTaskName] = useState('');

    const { isOffline, syncState, enqueue } = useOfflineSync(supabase, userId, setError);
    const reminders = useReminders();

    // Load tasks (owned + shared), this week's entries and shares
    useEffect(() => {
        // Ignore responses from a superseded request (e.g. fast week navigation)
        let cancelled = false;

        async function fetchData() {
            try {
                setLoading(true);
                setLoadFailed(false);
                setError(null);

                const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });

                const { data: tasksData, error: tasksError } = await supabase
                    .from('tasks')
                    .select('*')
                    .order('sort_order', { ascending: true })
                    .order('created_at', { ascending: true });
                if (tasksError) throw tasksError;

                // RLS returns your rows plus other members' rows on habits shared with you
                const { data: entriesData, error: entriesError } = await supabase
                    .from('entries')
                    .select('*')
                    .gte('entry_date', toDateStr(weekStart))
                    .lte('entry_date', toDateStr(addDays(weekStart, 6)));
                if (entriesError) throw entriesError;

                const { data: sharesData, error: sharesError } = await supabase.from('task_shares').select('*');

                if (cancelled) return;

                const allTasks = tasksData || [];
                const allEntries = entriesData || [];
                setTasks(allTasks.filter((t) => !t.archived));
                setArchivedTasks(allTasks.filter((t) => t.archived));
                // Overlay unsynced offline edits so a fetch can't hide them
                setEntries(applyOfflineQueue(allEntries.filter((e) => e.user_id === userId), readOfflineQueue(userId)));
                setPartnerCheckIns(
                    allEntries
                        .filter((e) => e.user_id !== userId && e.completed)
                        .map((e) => ({ task_id: e.task_id, user_id: e.user_id, entry_date: e.entry_date }))
                );
                if (!sharesError && sharesData) setTaskShares(sharesData);
            } catch (err) {
                if (cancelled) return;
                console.error('Error fetching data:', err);
                setLoadFailed(true);
                setError(err instanceof Error ? err.message : (err as { message?: string })?.message || 'Failed to sync with server.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        fetchData();

        return () => {
            cancelled = true;
        };
    }, [userId, currentDate, reloadKey, supabase]);

    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const todayStr = toDateStr(new Date());

    const { checkIns, isCompleted, toggle: handleToggle } = useCheckIns({
        supabase,
        userId,
        entries,
        setEntries,
        enqueue,
        onError: setError,
        onSaved: (taskId, dateStr, completed) => recordChange(taskId, dateStr, completed),
    });
    const { isEntryDone, getStreak, recordChange } = useStreaks(supabase, userId, checkIns);

    // How many partners completed a shared habit on a day
    const partnerCounts = useMemo(() => {
        const map = new Map<string, number>();
        for (const p of partnerCheckIns) {
            const key = `${p.task_id}|${p.entry_date}`;
            map.set(key, (map.get(key) ?? 0) + 1);
        }
        return map;
    }, [partnerCheckIns]);
    const partnerCount = useCallback(
        (taskId: string, dateStr: string) => partnerCounts.get(`${taskId}|${dateStr}`) ?? 0,
        [partnerCounts]
    );

    // Insert habits (single add, starter plan, AI goal breakdown). Returns whether they were saved.
    const handleAddTasksBatch = async (newHabits: NewHabit[]): Promise<boolean> => {
        if (!newHabits.length) return false;
        const baseOrder = nextSortOrder(tasks);

        const { data, error: insertError } = await supabase
            .from('tasks')
            .insert(newHabits.map((h, i) => ({
                user_id: userId,
                name: h.name,
                category: h.category || 'General',
                sort_order: baseOrder + i,
            })))
            .select();

        if (insertError || !data) {
            console.error('Error adding habits:', insertError);
            setError('Could not add habits. Please try again.');
            return false;
        }

        setTasks((prev) => [...prev, ...data]);
        return true;
    };

    const handleAddTask = async (name: string, category: string): Promise<boolean> => {
        setAddingTask(true);
        setError(null);
        try {
            return await handleAddTasksBatch([{ name, category }]);
        } finally {
            setAddingTask(false);
        }
    };

    const handleImportStarter = async () => {
        if (addingTask) return;
        setAddingTask(true);
        try {
            await handleAddTasksBatch(STARTER_HABITS);
        } finally {
            setAddingTask(false);
        }
    };

    // Archive: hide from tracker but keep all history (reversible)
    const setArchived = async (task: Task, archived: boolean) => {
        const moveTo = archived ? setArchivedTasks : setTasks;
        const moveFrom = archived ? setTasks : setArchivedTasks;

        moveFrom((prev) => prev.filter((t) => t.id !== task.id));
        moveTo((prev) => sortByOrder([...prev, { ...task, archived }]));

        const { data, error: updateError } = await supabase
            .from('tasks')
            .update({ archived })
            .eq('id', task.id)
            .select('id');

        // RLS denials affect 0 rows without raising an error, so check the returned rows too
        if (updateError || !data?.length) {
            console.error(`Error ${archived ? 'archiving' : 'restoring'} task:`, updateError);
            moveTo((prev) => prev.filter((t) => t.id !== task.id));
            moveFrom((prev) => sortByOrder([...prev, task]));
            setError(`Could not ${archived ? 'archive' : 'restore'} habit. Please try again.`);
        }
    };

    // Delete permanently (entries and shares are removed by ON DELETE CASCADE in one statement)
    const handleDeleteTask = async (task: Task) => {
        navigator.vibrate?.([40, 20, 20]);

        // Keep copies so the optimistic removal can be rolled back
        const removedEntries = entries.filter((e) => e.task_id === task.id);
        const removedPartnerCheckIns = partnerCheckIns.filter((p) => p.task_id === task.id);
        const removedShares = taskShares.filter((s) => s.task_id === task.id);

        setTasks((prev) => prev.filter((t) => t.id !== task.id));
        setArchivedTasks((prev) => prev.filter((t) => t.id !== task.id));
        setEntries((prev) => prev.filter((e) => e.task_id !== task.id));
        setPartnerCheckIns((prev) => prev.filter((p) => p.task_id !== task.id));
        setTaskShares((prev) => prev.filter((s) => s.task_id !== task.id));

        const { data, error: deleteError } = await supabase
            .from('tasks')
            .delete()
            .eq('id', task.id)
            .select('id');

        if (deleteError || !data?.length) {
            console.error('Error deleting task:', deleteError);
            (task.archived ? setArchivedTasks : setTasks)((prev) => sortByOrder([...prev, task]));
            setEntries((prev) => [...prev, ...removedEntries]);
            setPartnerCheckIns((prev) => [...prev, ...removedPartnerCheckIns]);
            setTaskShares((prev) => [...prev, ...removedShares]);
            setError('Could not delete habit. Nothing was removed.');
        }
    };

    const handleSaveEditTask = async (taskId: string) => {
        const newName = editingTaskName.trim();
        if (!newName) return;

        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, name: newName } : t)));
        setEditingTaskId(null);

        const { error: updateError } = await supabase.from('tasks').update({ name: newName }).eq('id', taskId);
        if (updateError) {
            console.error('Error updating task name:', updateError);
            setError('Could not update task name.');
        }
    };

    const editing: TaskEditing = {
        taskId: editingTaskId,
        name: editingTaskName,
        setName: setEditingTaskName,
        start: (task) => {
            setEditingTaskId(task.id);
            setEditingTaskName(task.name);
        },
        save: handleSaveEditTask,
        cancel: () => setEditingTaskId(null),
    };

    // Reordering. Only your own habits move; the order is saved in one request by reorder_tasks().
    // `previous` is restored if the save fails.
    const saveOrder = async (reordered: Task[], previous: Task[]) => {
        setTasks(withOwnedSortOrder(reordered, userId));
        const { error: saveOrderError } = await supabase.rpc('reorder_tasks', { p_task_ids: ownedTaskIds(reordered, userId) });
        if (saveOrderError) {
            console.error('Error saving habit order:', saveOrderError);
            setTasks(previous);
            setError('Could not save the new habit order.');
        }
    };

    // Drag-and-drop (desktop grid): rearrange locally while dragging, save on drop
    const dragStartOrderRef = useRef<Task[] | null>(null);

    const handleDragStart = (taskId: string) => {
        dragStartOrderRef.current = tasks;
        setDraggedTaskId(taskId);
    };

    const handleDragOver = (targetId: string) => {
        if (!draggedTaskId) return;
        const reordered = dragTask(tasks, draggedTaskId, targetId, userId);
        if (reordered) setTasks(reordered);
    };

    const handleDragEnd = () => {
        const previous = dragStartOrderRef.current;
        dragStartOrderRef.current = null;
        setDraggedTaskId(null);
        if (previous && previous.some((t, i) => t.id !== tasks[i]?.id)) {
            saveOrder(tasks, previous);
        }
    };

    // Move up/down (mobile menu, keyboard-friendly alternative to dragging)
    const handleMoveTask = (taskId: string, direction: -1 | 1) => {
        const reordered = moveTask(tasks, filteredTasks, taskId, direction, userId);
        if (reordered) saveOrder(reordered, tasks);
    };

    // Sharing
    const refreshShares = async () => {
        const { data } = await supabase.from('task_shares').select('*');
        if (data) setTaskShares(data);
    };

    const handleShare = async (email: string): Promise<string | null> => {
        if (!sharingTaskId) return null;
        // Server-side function verifies ownership + recipient and inserts the share
        const { data: status, error: shareError } = await supabase.rpc('share_task', { p_task_id: sharingTaskId, p_email: email });
        if (shareError) {
            console.error('Error sharing task:', shareError);
            return 'Could not share habit. Please try again.';
        }
        if (status !== 'ok') return SHARE_ERROR_MESSAGES[status] || 'Could not share habit.';
        await refreshShares();
        return null;
    };

    const handleRemoveShare = async (shareId: string): Promise<string | null> => {
        const { error: removeError } = await supabase.from('task_shares').delete().eq('id', shareId);
        if (removeError) {
            console.error('Error removing share:', removeError);
            return 'Could not remove collaborator.';
        }
        await refreshShares();
        return null;
    };

    const sharedTaskIds = useMemo(() => new Set(taskShares.map((s) => s.task_id)), [taskShares]);
    const isShared = useCallback(
        (task: Task) => sharedTaskIds.has(task.id) || task.user_id !== userId,
        [sharedTaskIds, userId]
    );

    // AI drawer: real per-habit numbers for the coach (from the 14-day streak window)
    const buildCoachStats = (): CoachHabitStat[] => {
        const now = new Date();
        const today = toDateStr(now);
        const last7 = Array.from({ length: 7 }, (_, i) => toDateStr(subDays(now, i)));

        return tasks.slice(0, 50).map((t) => ({
            name: t.name.slice(0, 120),
            category: (t.category || 'General').slice(0, 40),
            currentStreak: getStreak(t.id),
            doneToday: isEntryDone(t.id, today),
            completedLast7: last7.filter((d) => isEntryDone(t.id, d)).length,
        }));
    };

    // AI quick log: mark done for today, never un-check. False if the id isn't an active habit.
    const handleMarkTaskDoneToday = (taskId: string): boolean => {
        if (!tasks.some((t) => t.id === taskId)) return false;
        const today = toDateStr(new Date());
        if (!isEntryDone(taskId, today)) handleToggle(taskId, today, false);
        return true;
    };

    const handleReminderClick = () => {
        const today = toDateStr(new Date());
        const completedToday = tasks.filter((t) => isEntryDone(t.id, today)).length;
        if (reminders.permission === 'granted') reminders.sendProgressReminder(tasks.length, completedToday);
        else reminders.enableReminders(tasks.length, completedToday);
    };

    const categoryOptions = useMemo(() => buildCategoryOptions(tasks), [tasks]);
    const filteredTasks = tasks.filter((t) => matchesCategory(t, selectedCategoryFilter));
    const sharingTask = sharingTaskId ? tasks.find((t) => t.id === sharingTaskId) : undefined;

    const rowProps = {
        tasks: filteredTasks,
        userId,
        todayStr,
        isCompleted,
        partnerCount,
        isShared,
        getStreak,
        editing,
        onToggle: handleToggle,
        onShare: setSharingTaskId,
        onRemove: setTaskPendingRemoval,
    };

    return (
        <div className="flex-1 flex flex-col gap-4 sm:gap-6">
            <TrackerHeader
                currentDate={currentDate}
                weekStart={weekStart}
                syncState={syncState}
                reminderPermission={reminders.permission}
                onReminderClick={handleReminderClick}
                onShowBadges={() => setShowMilestones(true)}
                onPrevWeek={() => setCurrentDate((d) => subDays(d, 7))}
                onToday={() => setCurrentDate(new Date())}
                onNextWeek={() => setCurrentDate((d) => addDays(d, 7))}
                onPickDate={setCurrentDate}
            />

            {isOffline && (
                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 px-4 py-3 rounded-xl text-sm transition-all duration-200">
                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                    <span className="font-semibold">Offline Mode active. Actions are saved locally and will auto-upload when you go back online.</span>
                </div>
            )}

            {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

            {/* Category chips and (phones only) the cards/grid switch share one row */}
            {tasks.length > 0 && (
                <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                        <CategoryFilter options={categoryOptions} selected={selectedCategoryFilter} onSelect={setSelectedCategoryFilter} />
                    </div>
                    <ViewModeSwitch value={mobileViewMode} onChange={setMobileViewMode} cardsLabel="Daily cards" gridLabel="Full week grid" />
                </div>
            )}

            {loading || loadFailed || filteredTasks.length === 0 ? (
                // Loading, error and empty states show at every screen size
                <div className="bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-900 rounded-2xl flex-1 flex flex-col min-h-[300px]">
                    {loading ? (
                        <LoadingState label="Loading routine tasks..." />
                    ) : loadFailed ? (
                        /* Don't show the empty state (and its import button) when the data simply failed to load */
                        <div className="flex-1 flex flex-col items-center justify-center p-12 gap-3 text-center">
                            <CloudOff className="w-8 h-8 text-slate-400" />
                            <span className="text-sm text-slate-500 dark:text-slate-400 font-semibold">Could not load your habits.</span>
                            <button
                                onClick={() => setReloadKey((k) => k + 1)}
                                type="button"
                                className="h-11 px-6 rounded-xl bg-linear-to-tr from-violet-600 to-indigo-600 text-white font-bold text-sm shadow cursor-pointer"
                            >
                                Retry
                            </button>
                        </div>
                    ) : (
                        <EmptyState categoryFilter={selectedCategoryFilter} importing={addingTask} onImportStarter={handleImportStarter} />
                    )}
                </div>
            ) : (
                <>
                    {mobileViewMode === 'cards' && (
                        <MobileDayView key={toDateStr(weekStart)} weekDays={weekDays} {...rowProps} onMove={handleMoveTask} />
                    )}

                    {/* Week grid: always on tablet/desktop, on phones only in grid mode */}
                    <div className={`bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-900 rounded-2xl overflow-hidden flex-col ${mobileViewMode === 'matrix' ? 'flex' : 'hidden sm:flex'}`}>
                        <WeekGrid
                            weekDays={weekDays}
                            {...rowProps}
                            draggedTaskId={draggedTaskId}
                            onDragStart={handleDragStart}
                            onDragOver={handleDragOver}
                            onDragEnd={handleDragEnd}
                        />
                    </div>
                </>
            )}

            <AddHabitForm adding={addingTask} onAdd={handleAddTask} />

            <ArchivedHabits
                tasks={archivedTasks}
                userId={userId}
                onRestore={(task) => setArchived(task, false)}
                onDelete={setTaskPendingRemoval}
            />

            {taskPendingRemoval && (
                <RemoveHabitDialog
                    task={taskPendingRemoval}
                    onCancel={() => setTaskPendingRemoval(null)}
                    onArchive={(task) => {
                        setArchived(task, true);
                        setTaskPendingRemoval(null);
                    }}
                    onDelete={(task) => {
                        handleDeleteTask(task);
                        setTaskPendingRemoval(null);
                    }}
                />
            )}

            {sharingTask && (
                <ShareHabitDialog
                    task={sharingTask}
                    shares={taskShares.filter((s) => s.task_id === sharingTask.id)}
                    onShare={handleShare}
                    onRemoveShare={handleRemoveShare}
                    onClose={() => setSharingTaskId(null)}
                />
            )}

            {showMilestones && <MilestonesDialog onClose={() => setShowMilestones(false)} />}

            <AICoachDrawer
                tasks={tasks}
                buildCoachStats={buildCoachStats}
                onAddTasksBatch={handleAddTasksBatch}
                onMarkTaskDone={handleMarkTaskDoneToday}
            />
        </div>
    );
}

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
import {
    ChevronLeft,
    ChevronRight,
    Calendar as CalendarIcon,
    Plus,
    Loader2,
    Check,
    X,
    ShieldAlert,
    CheckSquare,
    GripVertical,
    Share2,
    Users,
    Cloud,
    CloudOff,
    Archive,
    Sparkles,
    Trash2
} from 'lucide-react';

interface Task {
    id: string;
    name: string;
    sort_order: number;
    archived: boolean;
    created_at: string;
    category: string;
    user_id: string;
}

interface Entry {
    id?: string;
    task_id: string;
    entry_date: string;
    completed: boolean;
}

interface QueuedEntry {
    task_id: string;
    entry_date: string;
    completed: boolean;
    timestamp: string;
}

interface TaskShare {
    id: string;
    task_id: string;
    shared_with_email: string;
}

export default function WeeklyTracker() {
    const supabase = createClient();
    const [userId, setUserId] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string | null>(null);

    // States
    const [currentDate, setCurrentDate] = useState<Date>(new Date());
    const [tasks, setTasks] = useState<Task[]>([]);
    const [entries, setEntries] = useState<Entry[]>([]);
    const [taskShares, setTaskShares] = useState<TaskShare[]>([]);
    const [loading, setLoading] = useState(true);
    const [addingTask, setAddingTask] = useState(false);
    const [newTaskName, setNewTaskName] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Categories
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');
    const [newTaskCategory, setNewTaskCategory] = useState<string>('General');

    // Offline Buffering States
    const [isOffline, setIsOffline] = useState(false);
    const [offlineQueue, setOfflineQueue] = useState<QueuedEntry[]>([]);
    const [syncingOffline, setSyncingOffline] = useState(false);

    // Drag-and-Drop Order State
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

    // Shared Collaborative Modal
    const [sharingTaskId, setSharingTaskId] = useState<string | null>(null);
    const [collaboratorEmail, setCollaboratorEmail] = useState<string>('');
    const [addingShare, setAddingShare] = useState(false);

    // Reference for scrolling
    const tableContainerRef = useRef<HTMLDivElement>(null);

    // Fetch current user details
    useEffect(() => {
        async function init() {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (user) {
                setUserId(user.id);
                setUserEmail(user.email || null);
            }
        }
        init();
    }, []);

    // Background sync of queued local tasks
    const syncOfflineQueue = async (currentUserId: string) => {
        if (!navigator.onLine || !currentUserId || syncingOffline) return;
        const saved = localStorage.getItem('focusflow_offline_queue');
        if (!saved) return;

        try {
            setSyncingOffline(true);
            const queue: QueuedEntry[] = JSON.parse(saved);
            if (queue.length === 0) return;

            const upsertPayload = queue.map((item) => ({
                task_id: item.task_id,
                user_id: currentUserId,
                entry_date: item.entry_date,
                completed: item.completed,
                completed_at: item.completed ? item.timestamp : null,
            }));

            const { error: syncError } = await supabase
                .from('entries')
                .upsert(upsertPayload, { onConflict: 'task_id,entry_date' });

            if (syncError) throw syncError;

            // Clear local queue
            localStorage.removeItem('focusflow_offline_queue');
            setOfflineQueue([]);

            // Refetch fresh entries to sync state
            const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
            const { data: updatedEntries, error: fetchError } = await supabase
                .from('entries')
                .select('*')
                .gte('entry_date', format(weekStart, 'yyyy-MM-dd'))
                .lte('entry_date', format(addDays(weekStart, 6), 'yyyy-MM-dd'));

            if (!fetchError && updatedEntries) {
                setEntries(updatedEntries);
            }
        } catch (err: any) {
            console.error('Error syncing offline queue:', err);
            setError('Failed to sync offline edits with the server.');
        } finally {
            setSyncingOffline(false);
        }
    };

    // Monitor connectivity and offline state
    useEffect(() => {
        if (typeof window === 'undefined') return;

        setIsOffline(!navigator.onLine);

        const handleOnline = () => {
            setIsOffline(false);
            if (userId) {
                syncOfflineQueue(userId);
            }
        };

        const handleOffline = () => {
            setIsOffline(true);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Load cached queue
        const saved = localStorage.getItem('focusflow_offline_queue');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setOfflineQueue(parsed);
                if (navigator.onLine && userId && parsed.length > 0) {
                    syncOfflineQueue(userId);
                }
            } catch (e) {
                console.error(e);
            }
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [userId]);

    // Fetch tasks, shares, and entries when user or date changes
    useEffect(() => {
        if (!userId) return;

        async function fetchData() {
            try {
                setLoading(true);
                setError(null);

                // Fetch active tasks (owns + shared)
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

                // Fetch collaborators task shares list
                const { data: sharesData, error: sharesError } = await supabase
                    .from('task_shares')
                    .select('*');

                setTasks(tasksData || []);
                setEntries(entriesData || []);
                if (!sharesError && sharesData) {
                    setTaskShares(sharesData);
                }
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

        // Perform mobile haptic feedback vibration
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            navigator.vibrate([15]);
        }

        // Trigger optimistic UI update
        startTransition(() => {
            setOptimisticEntries({
                type: 'TOGGLE',
                taskId,
                dateStr,
                completed: newCompleted,
            });
        });

        const timestamp = new Date().toISOString();

        // Handle offline caching state
        if (!navigator.onLine) {
            const freshQueueIndex = offlineQueue.findIndex(q => q.task_id === taskId && q.entry_date === dateStr);
            let updatedQueue = [...offlineQueue];

            if (freshQueueIndex > -1) {
                updatedQueue[freshQueueIndex] = { task_id: taskId, entry_date: dateStr, completed: newCompleted, timestamp };
            } else {
                updatedQueue.push({ task_id: taskId, entry_date: dateStr, completed: newCompleted, timestamp });
            }

            setOfflineQueue(updatedQueue);
            localStorage.setItem('focusflow_offline_queue', JSON.stringify(updatedQueue));

            // Sync baseline local state
            const targetIndex = entries.findIndex(e => e.task_id === taskId && e.entry_date === dateStr);
            if (targetIndex > -1) {
                const refreshed = [...entries];
                refreshed[targetIndex] = { ...refreshed[targetIndex], completed: newCompleted };
                setEntries(refreshed);
            } else {
                setEntries([...entries, { task_id: taskId, entry_date: dateStr, completed: newCompleted }]);
            }
            return;
        }

        try {
            // Background Sync to Supabase
            const { error: upsertError } = await supabase.from('entries').upsert(
                {
                    task_id: taskId,
                    user_id: userId,
                    entry_date: dateStr,
                    completed: newCompleted,
                    completed_at: newCompleted ? timestamp : null,
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
    const handleAddTask = async (name: string, category: string) => {
        if (!name.trim() || !userId) return;

        setAddingTask(true);
        setError(null);

        const nextOrder = tasks.length > 0 ? Math.max(...tasks.map((t) => t.sort_order)) + 1 : 0;

        try {
            const { data: addedTask, error: addError } = await supabase
                .from('tasks')
                .insert({
                    name: name.trim(),
                    sort_order: nextOrder,
                    user_id: userId,
                    category: category,
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

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleAddTask(newTaskName, newTaskCategory);
    };

    // Quick add default/recommended tasks for empty state
    const handleAddDefaultHabits = async () => {
        const presets = [
            { name: 'Drink 8 glasses of water', category: 'Health' },
            { name: 'Exercise for 30 minutes', category: 'Health' },
            { name: 'Read 10 pages of a book', category: 'Personal' },
            { name: 'Power focus session (1h)', category: 'Work' },
        ];

        for (const item of presets) {
            await handleAddTask(item.name, item.category);
        }
    };



    // Delete task permanently
    const handleDeleteTask = async (taskId: string) => {
        if (!userId) return;

        // Perform vibration
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            navigator.vibrate([40, 20, 20]);
        }

        const confirmMsg = "Are you sure you want to permanently delete this habit and all its completions? This action cannot be undone.";
        if (typeof window !== 'undefined' && !window.confirm(confirmMsg)) {
            return;
        }

        try {
            // Optimistic update
            setTasks(prev => prev.filter(t => t.id !== taskId));

            const { error: deleteError } = await supabase
                .from('tasks')
                .delete()
                .eq('id', taskId);

            if (deleteError) throw deleteError;
        } catch (err: any) {
            console.error('Error deleting task:', err);
            setError('Could not delete task.');
        }
    };

    // Drag-and-drop handles
    const handleDragStart = (e: React.DragEvent, taskId: string) => {
        setDraggedTaskId(taskId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        if (!draggedTaskId || draggedTaskId === targetId) return;

        const draggedIndex = tasks.findIndex((t) => t.id === draggedTaskId);
        const targetIndex = tasks.findIndex((t) => t.id === targetId);
        if (draggedIndex === -1 || targetIndex === -1) return;

        const reordered = [...tasks];
        const [draggedItem] = reordered.splice(draggedIndex, 1);
        reordered.splice(targetIndex, 0, draggedItem);

        // Update list sorting order locally
        setTasks(reordered);
    };

    const handleDragEnd = async () => {
        if (!draggedTaskId || !userId) return;
        setDraggedTaskId(null);

        // Update sort indices in Supabase
        const upsertPayload = tasks.map((task, idx) => ({
            id: task.id,
            user_id: task.user_id,
            name: task.name,
            category: task.category,
            sort_order: idx,
            archived: task.archived,
        }));

        try {
            const { error: saveOrderError } = await supabase
                .from('tasks')
                .upsert(upsertPayload);

            if (saveOrderError) throw saveOrderError;
        } catch (e) {
            console.error('Error saving updated tasks order:', e);
            setError('Failed to sync new order with cloud.');
        }
    };

    // Collaborators User Task Sharing Submission
    const handleCreateShare = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!sharingTaskId || !collaboratorEmail.trim()) return;

        setAddingShare(true);
        setError(null);

        const emailClean = collaboratorEmail.trim().toLowerCase();

        try {
            // Check if the user with this email exists in the database
            const { data: userExists, error: checkError } = await supabase
                .rpc('user_email_exists', { target_email: emailClean });

            if (checkError) throw checkError;

            if (!userExists) {
                setError('This user email is not registered with FocusFlow.');
                setAddingShare(false);
                return;
            }

            const { error: shareError } = await supabase
                .from('task_shares')
                .insert({
                    task_id: sharingTaskId,
                    shared_with_email: emailClean,
                });

            if (shareError) throw shareError;

            // Update shares list local state
            const { data: updatedShares } = await supabase
                .from('task_shares')
                .select('*');

            if (updatedShares) {
                setTaskShares(updatedShares);
            }

            setCollaboratorEmail('');
        } catch (err: any) {
            console.error('Error sharing task:', err);
            setError(err.message || 'Could not share task. Make sure tables exist.');
        } finally {
            setAddingShare(false);
        }
    };

    // Remove tasks collaboration share
    const handleRemoveShare = async (shareId: string) => {
        try {
            const { error: removeError } = await supabase
                .from('task_shares')
                .delete()
                .eq('id', shareId);

            if (removeError) throw removeError;

            // Update shares list local state
            const { data: updatedShares } = await supabase
                .from('task_shares')
                .select('*');

            if (updatedShares) {
                setTaskShares(updatedShares);
            }
        } catch (err: any) {
            console.error('Error removing share:', err);
            setError('Could not remove collaborator.');
        }
    };

    // Filter tasks based on selected tab category
    const filteredTasks = tasks.filter(
        (t) => selectedCategoryFilter === 'All' || t.category === selectedCategoryFilter
    );

    // Compute cloud sync state
    const syncState: 'synced' | 'syncing' | 'offline' = isOffline
        ? 'offline'
        : (offlineQueue.length > 0 || syncingOffline) ? 'syncing' : 'synced';

    return (
        <div className="flex-1 flex flex-col gap-6">
            {/* Header controls layout */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900/40 p-4 border border-slate-205 dark:border-slate-900 rounded-2xl backdrop-blur transition-all duration-200">
                <div className="flex items-center justify-between md:justify-start gap-4">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight">
                            {format(currentDate, 'MMMM yyyy')}
                        </h2>
                    </div>

                    {/* Sync Status Badge */}
                    <div className="flex items-center">
                        {syncState === 'synced' && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
                                <Cloud className="w-3.5 h-3.5" />
                                <span>Synced</span>
                            </div>
                        )}
                        {syncState === 'syncing' && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 animate-pulse">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Syncing</span>
                            </div>
                        )}
                        {syncState === 'offline' && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-500 bg-amber-500/10">
                                <CloudOff className="w-3.5 h-3.5 animate-bounce" />
                                <span>Offline</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Nav buttons */}
                    <div className="flex items-center h-10 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-1 transition-colors">
                        <button
                            onClick={prevWeek}
                            className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-900 transition-all select-none cursor-pointer"
                            aria-label="Previous week"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            onClick={jumpToToday}
                            className="h-8 px-3 flex items-center justify-center rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-900 transition-all select-none cursor-pointer"
                        >
                            Today
                        </button>
                        <button
                            onClick={nextWeek}
                            className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-900 transition-all select-none cursor-pointer"
                            aria-label="Next week"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Jump Picker showing week start to end */}
                    <div className="relative flex items-center h-10 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 transition-all cursor-pointer">
                        <CalendarIcon className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 select-none whitespace-nowrap">
                            {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}
                        </span>
                        <input
                            type="date"
                            value={format(currentDate, 'yyyy-MM-dd')}
                            onChange={(e) => {
                                if (e.target.value) {
                                    setCurrentDate(new Date(e.target.value));
                                }
                            }}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                    </div>
                </div>
            </div>

            {/* Offline Sync Notices */}
            {isOffline && (
                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 px-4 py-3 rounded-xl text-sm transition-all duration-200 animate-slide-in">
                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
                    <span className="font-semibold">Offline Mode active. Actions are saved locally and will auto-upload when you go back online.</span>
                </div>
            )}

            {/* Category Filter Tabs */}
            <div className="flex flex-wrap gap-1.5 p-1.5 bg-white dark:bg-slate-900/30 border border-slate-205 dark:border-slate-900 rounded-2xl w-fit transition-colors">
                {['All', 'General', 'Work', 'Health', 'Personal'].map((cat) => (
                    <button
                        key={cat}
                        onClick={() => setSelectedCategoryFilter(cat)}
                        className={`px-4 py-1.5 rounded-xl text-xs font-bold cursor-pointer select-none transition-all ${selectedCategoryFilter === cat
                            ? 'bg-gradient-to-tr from-violet-600 to-indigo-600 border border-violet-500 text-white shadow-md'
                            : 'text-slate-500 dark:text-slate-400 border border-transparent hover:text-slate-850 dark:hover:text-slate-200 hover:border-slate-200 dark:hover:border-slate-800'
                            }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {error && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm animate-slide-in">
                    <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                    <span className="font-semibold">{error}</span>
                    <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-600">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Main Grid Card */}
            <div className="bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-900 rounded-2xl overflow-hidden backdrop-blur flex-1 flex flex-col justify-start relative transition-colors duration-200 min-h-[300px]">
                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 gap-3">
                        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
                        <span className="text-sm text-slate-500 dark:text-slate-400 font-semibold">Loading routine tasks...</span>
                    </div>
                ) : filteredTasks.length === 0 ? (
                    /* Beautiful Empty State with recommendations picker */
                    <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-12 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-5 animate-pulse">
                            <Sparkles className="w-8 h-8 text-violet-500" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Your Routine Tracker is Ready!</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mt-2 leading-relaxed">
                            {selectedCategoryFilter === 'All'
                                ? 'Kickstart your routine by adding custom habits below, or fast-track by importing these recommended starter goals:'
                                : `No tasks created under "${selectedCategoryFilter}" category yet.`}
                        </p>

                        {selectedCategoryFilter === 'All' && (
                            <div className="mt-6 flex flex-col items-center gap-3">
                                <button
                                    onClick={handleAddDefaultHabits}
                                    type="button"
                                    className="px-5 py-2.5 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white font-bold text-xs shadow-md shadow-violet-600/25 hover:from-violet-500 hover:to-indigo-500 active:scale-95 transition-all cursor-pointer select-none"
                                >
                                    Import Starter Habit Plan
                                </button>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                                    Adds: Water, Exercise, Reading, Focus block
                                </span>
                            </div>
                        )}
                    </div>
                ) : (
                    /* Table Container with drag/swipe and sticky styling */
                    <div ref={tableContainerRef} className="overflow-x-auto relative w-full flex-1 touch-pan-y">
                        <table className="w-full border-collapse text-left min-w-[750px]">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-900 transition-colors">
                                    {/* Sticky Task Name Column Header */}
                                    <th className="sticky left-0 bg-slate-50 dark:bg-slate-950/80 z-20 px-6 py-4 font-bold text-xs sm:text-sm text-slate-500 dark:text-slate-450 w-[260px] border-r border-slate-200 dark:border-slate-900 backdrop-blur-md shadow-sm">
                                        Routine Task & Collaborators
                                    </th>
                                    {/* 7 Days Column Header */}
                                    {weekDays.map((day, idx) => {
                                        const isDayToday = isToday(day);
                                        return (
                                            <th
                                                key={idx}
                                                className={`px-4 py-4 text-center font-extrabold text-xs border-r border-slate-200/60 dark:border-slate-900/50 last:border-r-0 ${isDayToday ? 'text-violet-500 dark:text-violet-400' : 'text-slate-500 dark:text-slate-400'
                                                    }`}
                                            >
                                                <div className="flex flex-col items-center">
                                                    <span className="uppercase text-[9px] tracking-wider mb-0.5">
                                                        {format(day, 'eee')}
                                                    </span>
                                                    <span
                                                        className={`w-7 h-7 flex items-center justify-center rounded-full font-bold text-xs sm:text-sm tracking-tight ${isDayToday ? 'bg-violet-600/10 dark:bg-violet-600/20 text-violet-600 dark:text-violet-400 ring-2 ring-violet-500/20' : ''
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
                                {filteredTasks.map((task, index) => {
                                    // Check if task is shared
                                    const sharesForTask = taskShares.filter(s => s.task_id === task.id);
                                    const isShared = sharesForTask.length > 0 || task.user_id !== userId;

                                    return (
                                        <tr
                                            key={task.id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, task.id)}
                                            onDragOver={(e) => handleDragOver(e, task.id)}
                                            onDragEnd={handleDragEnd}
                                            className="hover:bg-slate-100/40 dark:hover:bg-slate-900/20 select-none relative group transition-all duration-155"
                                            style={{
                                                opacity: draggedTaskId === task.id ? 0.4 : 1,
                                            }}
                                        >
                                            {/* Sticky Task Row Cell */}
                                            <td className="sticky left-0 bg-white dark:bg-slate-950 z-10 px-4 py-3 border-r border-slate-205 dark:border-slate-900 w-[260px] shadow-sm transition-colors duration-200">
                                                <div className="flex items-center gap-1.5">
                                                    {/* Drag Handle representation */}
                                                    <div className="text-slate-350 dark:text-slate-600 hover:text-slate-500 cursor-grab active:cursor-grabbing p-1">
                                                        <GripVertical className="w-3.5 h-3.5" />
                                                    </div>

                                                    <div className="flex-1 min-w-0 pr-1 group">
                                                        <div className="flex items-center gap-1.5 w-full">
                                                            <span className="truncate text-slate-800 dark:text-slate-100 text-sm font-semibold leading-tight">{task.name}</span>

                                                            {/* Collaborative users badge */}
                                                            {isShared && (
                                                                <span className="flex-shrink-0" title="Collaborative Shared Habit">
                                                                    <Users className="w-3.5 h-3.5 text-indigo-500" />
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Category and Sharing triggers */}
                                                        <div className="flex items-center justify-between mt-1">
                                                            <span className="text-[9px] text-slate-500 font-extrabold tracking-wider uppercase">
                                                                {task.category || 'General'}
                                                            </span>

                                                            {/* Share & Delete action buttons if current user owns the task */}
                                                            {task.user_id === userId && (
                                                                <div className="flex items-center gap-1">
                                                                    <button
                                                                        onClick={() => setSharingTaskId(task.id)}
                                                                        type="button"
                                                                        className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-400 hover:text-indigo-500 transition-colors cursor-pointer flex items-center justify-center"
                                                                        title="Share habit with partner"
                                                                    >
                                                                        <Share2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteTask(task.id)}
                                                                        type="button"
                                                                        className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer flex items-center justify-center"
                                                                        title="Delete habit permanently"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* 7 Days completions checkboxes */}
                                            {weekDays.map((day, dIdx) => {
                                                const dateStr = format(day, 'yyyy-MM-dd');
                                                const entryMatch = optimisticEntries.find(
                                                    (e) => e.task_id === task.id && e.entry_date === dateStr
                                                );
                                                const isCompleted = entryMatch?.completed || false;

                                                return (
                                                    <td
                                                        key={dIdx}
                                                        className="px-2 py-2 text-center border-r border-slate-100 dark:border-slate-900/30 last:border-r-0"
                                                    >
                                                        <div className="flex justify-center items-center">
                                                            <button
                                                                onClick={() => handleToggle(task.id, dateStr, isCompleted)}
                                                                type="button"
                                                                className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center focus:outline-none transition-all active:scale-90 border cursor-pointer ${isCompleted
                                                                    ? 'bg-gradient-to-tr from-violet-600 to-indigo-600 border-violet-500 text-white shadow-lg shadow-violet-500/25 ring-2 ring-violet-500/20'
                                                                    : 'bg-slate-100 dark:bg-slate-950/40 hover:bg-slate-200 dark:hover:bg-slate-950 border-slate-205 dark:border-slate-800 text-transparent hover:text-slate-400 dark:hover:text-slate-700'
                                                                    }`}
                                                            >
                                                                <Check className="w-5 h-5 stroke-[3px] transition-transform" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Write New Task Form */}
            <form
                onSubmit={handleFormSubmit}
                className="flex flex-col gap-3 bg-white dark:bg-slate-900/40 p-4 border border-slate-205 dark:border-slate-900 rounded-2xl backdrop-blur mt-auto transition-colors duration-200"
            >
                <div className="flex gap-2 flex-wrap items-center">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-wider mr-1 select-none pointer-events-none">Category:</span>
                    {['General', 'Work', 'Health', 'Personal'].map((cat) => (
                        <button
                            key={cat}
                            type="button"
                            onClick={() => setNewTaskCategory(cat)}
                            className={`px-3 py-1 rounded-full text-xs font-bold select-none cursor-pointer transition-all border ${newTaskCategory === cat
                                ? 'bg-gradient-to-tr from-violet-600 to-indigo-600 border-violet-500 text-white shadow shadow-violet-600/30'
                                : 'bg-slate-100 dark:bg-slate-950/40 border-slate-200 dark:border-slate-850 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:border-slate-400 dark:hover:border-slate-700'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2">
                    <input
                        value={newTaskName}
                        onChange={(e) => setNewTaskName(e.target.value)}
                        disabled={addingTask}
                        placeholder="I want to work on..."
                        className="flex-1 appearance-none bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 px-4 py-2.5 rounded-xl text-sm placeholder-slate-400 dark:placeholder-slate-500 text-slate-800 dark:text-slate-205 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-transparent transition-all"
                    />
                    <button
                        type="submit"
                        disabled={addingTask || !newTaskName.trim()}
                        className="flex items-center justify-center bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl disabled:opacity-40 transition-all select-none duration-150 cursor-pointer whitespace-nowrap"
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
                </div>
            </form>

            {/* Sharing collaborator modal popup */}
            {sharingTaskId && (() => {
                const targetTask = tasks.find(t => t.id === sharingTaskId);
                const activeShares = taskShares.filter(s => s.task_id === sharingTaskId);
                return (
                    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl animate-scale-up">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-1.5 animate-pulse-subtle">
                                        <Users className="w-4 h-4 text-violet-500" />
                                        Share Habit
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        Habit: <span className="font-semibold text-slate-700 dark:text-slate-200">{targetTask?.name}</span>
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        setSharingTaskId(null);
                                        setCollaboratorEmail('');
                                        setError(null);
                                    }}
                                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-450 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* List of active shares */}
                            {activeShares.length > 0 && (
                                <div className="mb-4">
                                    <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 dark:text-slate-500 block mb-2">Active Collaborators</span>
                                    <div className="flex flex-col gap-2 max-h-28 overflow-y-auto pr-1">
                                        {activeShares.map((share) => (
                                            <div key={share.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 px-3 py-2 border border-slate-150 dark:border-slate-850 rounded-xl text-xs">
                                                <span className="text-slate-700 dark:text-slate-300 truncate mr-2">{share.shared_with_email}</span>
                                                <button
                                                    onClick={() => handleRemoveShare(share.id)}
                                                    type="button"
                                                    className="text-[10px] text-rose-500 hover:text-rose-600 font-bold hover:underline cursor-pointer"
                                                >
                                                    Stop Share
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <form onSubmit={handleCreateShare} className="flex flex-col gap-3">
                                <div>
                                    <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 dark:text-slate-500 block mb-2">Invite Collaborator</span>
                                    <input
                                        type="email"
                                        required
                                        value={collaboratorEmail}
                                        onChange={(e) => setCollaboratorEmail(e.target.value)}
                                        placeholder="partner@gmail.com"
                                        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-2.5 w-full rounded-xl text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-transparent transition-all"
                                    />
                                </div>

                                {error && (
                                    <span className="text-rose-500 dark:text-rose-455 text-xs font-semibold leading-tight">{error}</span>
                                )}

                                <div className="flex justify-end gap-2 mt-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSharingTaskId(null);
                                            setCollaboratorEmail('');
                                            setError(null);
                                        }}
                                        className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all select-none cursor-pointer"
                                    >
                                        Close
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={addingShare || !collaboratorEmail.trim()}
                                        className="px-4 py-2 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white font-bold text-xs shadow hover:from-violet-500 hover:to-indigo-500 transition-all select-none cursor-pointer disabled:opacity-40"
                                    >
                                        {addingShare ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Invite'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}

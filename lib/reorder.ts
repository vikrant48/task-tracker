import type { Task } from '@/lib/types';

// Habit order is per owner: you can only reorder habits you own (a collaborator can't rearrange
// the owner's list). Habits shared with you keep the position their owner gave them.

export const ownedTaskIds = (tasks: Task[], userId: string) =>
    tasks.filter((t) => t.user_id === userId).map((t) => t.id);

// Give owned habits sort_order 0..n-1 in their current order (mirrors the reorder_tasks() function)
export function withOwnedSortOrder(tasks: Task[], userId: string): Task[] {
    let position = 0;
    return tasks.map((t) => (t.user_id === userId ? { ...t, sort_order: position++ } : t));
}

// Drag-and-drop: place `draggedId` where `targetId` is. Null if either isn't owned by the user.
export function dragTask(tasks: Task[], draggedId: string, targetId: string, userId: string): Task[] | null {
    const from = tasks.findIndex((t) => t.id === draggedId);
    const to = tasks.findIndex((t) => t.id === targetId);
    if (from === -1 || to === -1 || from === to) return null;
    if (tasks[from].user_id !== userId || tasks[to].user_id !== userId) return null;

    const reordered = [...tasks];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    return reordered;
}

// Move up/down: swap with the nearest owned habit that is visible (respects the category filter).
// Null if there is nothing to swap with.
export function moveTask(tasks: Task[], visible: Task[], taskId: string, direction: -1 | 1, userId: string): Task[] | null {
    const visibleOwned = visible.filter((t) => t.user_id === userId);
    const index = visibleOwned.findIndex((t) => t.id === taskId);
    const neighbour = index === -1 ? undefined : visibleOwned[index + direction];
    if (!neighbour) return null;

    const a = tasks.findIndex((t) => t.id === taskId);
    const b = tasks.findIndex((t) => t.id === neighbour.id);
    const reordered = [...tasks];
    [reordered[a], reordered[b]] = [reordered[b], reordered[a]];
    return reordered;
}

import type { Task } from '@/lib/types';

// Inline rename state, shared by the mobile cards and the desktop grid
export interface TaskEditing {
    taskId: string | null;
    name: string;
    setName: (name: string) => void;
    start: (task: Task) => void;
    save: (taskId: string) => void;
    cancel: () => void;
}

export interface TaskRowProps {
    tasks: Task[];
    userId: string;
    todayStr: string;
    isCompleted: (taskId: string, dateStr: string) => boolean;
    // Partners who completed a shared habit on a day (read-only)
    partnerCount: (taskId: string, dateStr: string) => number;
    isShared: (task: Task) => boolean;
    getStreak: (taskId: string) => number;
    editing: TaskEditing;
    onToggle: (taskId: string, dateStr: string, currentlyCompleted: boolean) => void;
    onShare: (taskId: string) => void;
    onRemove: (task: Task) => void;
}

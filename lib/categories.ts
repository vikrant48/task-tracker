export const HABIT_CATEGORIES = ['General', 'Work', 'Health', 'Personal'] as const;

export const ALL_CATEGORIES = 'All';

const categoryOf = (task: { category: string | null }) => task.category || 'General';

// Filter options: "All", the built-in categories, then any custom ones (e.g. from AI goal breakdown)
export function buildCategoryOptions(tasks: { category: string | null }[]): string[] {
    return [ALL_CATEGORIES, ...Array.from(new Set<string>([...HABIT_CATEGORIES, ...tasks.map(categoryOf)]))];
}

export function matchesCategory(task: { category: string | null }, filter: string): boolean {
    return filter === ALL_CATEGORIES || categoryOf(task) === filter;
}

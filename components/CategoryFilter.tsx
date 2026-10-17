'use client';

interface CategoryFilterProps {
    options: string[];
    selected: string;
    onSelect: (category: string) => void;
}

// One swipeable row of chips (no wrapping), so it never pushes content down on phones
export default function CategoryFilter({ options, selected, onSelect }: CategoryFilterProps) {
    return (
        <div role="group" aria-label="Filter by category" className="flex gap-2 overflow-x-auto no-scrollbar pr-6 mask-[linear-gradient(to_right,#000_calc(100%-2rem),transparent)] sm:pr-0 sm:flex-wrap sm:mask-none">
            {options.map((cat) => (
                <button
                    key={cat}
                    type="button"
                    onClick={() => onSelect(cat)}
                    aria-pressed={selected === cat}
                    className={`h-9 px-4 shrink-0 rounded-full text-sm font-semibold cursor-pointer select-none transition-colors border ${selected === cat
                        ? 'bg-linear-to-tr from-violet-600 to-indigo-600 border-violet-500 text-white shadow-sm'
                        : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                >
                    {cat}
                </button>
            ))}
        </div>
    );
}

'use client';

interface CategoryFilterProps {
    options: string[];
    selected: string;
    onSelect: (category: string) => void;
}

export default function CategoryFilter({ options, selected, onSelect }: CategoryFilterProps) {
    return (
        <div className="flex flex-wrap gap-1.5 p-1.5 bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-900 rounded-2xl w-fit max-w-full transition-colors">
            {options.map((cat) => (
                <button
                    key={cat}
                    type="button"
                    onClick={() => onSelect(cat)}
                    aria-pressed={selected === cat}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer select-none transition-all ${selected === cat
                        ? 'bg-linear-to-tr from-violet-600 to-indigo-600 border border-violet-500 text-white shadow'
                        : 'text-slate-500 dark:text-slate-400 border border-transparent hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-200 dark:hover:border-slate-800'
                        }`}
                >
                    {cat}
                </button>
            ))}
        </div>
    );
}

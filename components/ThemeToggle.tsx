'use client';

import { useSyncExternalStore } from 'react';
import { Sun, Moon } from 'lucide-react';
import { THEME_STORAGE_KEY, type Theme } from '@/lib/theme';

// The theme lives on <html class="dark">, set before paint by the root layout's inline script.
// Read it as an external store so the icon always matches what's on screen.
function subscribe(onChange: () => void) {
    const observer = new MutationObserver(onChange);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
}

const getTheme = (): Theme => (document.documentElement.classList.contains('dark') ? 'dark' : 'light');

export default function ThemeToggle() {
    // Server render matches the layout's default (dark)
    const theme = useSyncExternalStore(subscribe, getTheme, () => 'dark' as Theme);
    const next: Theme = theme === 'dark' ? 'light' : 'dark';

    const toggleTheme = () => {
        document.documentElement.classList.toggle('dark', next === 'dark');
        try {
            localStorage.setItem(THEME_STORAGE_KEY, next);
        } catch {
            // Storage unavailable (private mode): the choice just won't persist
        }
    };

    const label = next === 'light' ? 'Switch to Light Mode' : 'Switch to Dark Mode';

    return (
        <button
            onClick={toggleTheme}
            type="button"
            aria-label={label}
            title={label}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all select-none cursor-pointer flex items-center justify-center"
        >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-violet-500" />}
        </button>
    );
}

'use client';

import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
    const [theme, setTheme] = useState<'light' | 'dark'>('dark');

    // On mount, read cached theme or default to system
    useEffect(() => {
        const saved = localStorage.getItem('focusflow_theme');
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (saved === 'light') {
            setTheme('light');
            document.documentElement.classList.remove('dark');
        } else if (saved === 'dark' || systemPrefersDark) {
            setTheme('dark');
            document.documentElement.classList.add('dark');
        } else {
            setTheme('light');
            document.documentElement.classList.remove('dark');
        }
    }, []);

    const toggleTheme = () => {
        if (theme === 'dark') {
            setTheme('light');
            localStorage.setItem('focusflow_theme', 'light');
            document.documentElement.classList.remove('dark');
        } else {
            setTheme('dark');
            localStorage.setItem('focusflow_theme', 'dark');
            document.documentElement.classList.add('dark');
        }
    };

    return (
        <button
            onClick={toggleTheme}
            type="button"
            className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all select-none cursor-pointer flex items-center justify-center"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-violet-400" />}
        </button>
    );
}

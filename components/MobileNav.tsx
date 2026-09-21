'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar, BarChart2, History as HistoryIcon, Sparkles } from 'lucide-react';

export default function MobileNav() {
    const pathname = usePathname();

    const navItems = [
        {
            href: '/',
            label: 'Tracker',
            icon: Calendar,
        },
        {
            href: '/history',
            label: 'History',
            icon: HistoryIcon,
        },
        {
            href: '/analytics',
            label: 'Analytics',
            icon: BarChart2,
        },
    ];

    return (
        <nav className="sm:hidden fixed bottom-3 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm border border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl flex justify-around items-center p-1.5 z-40 transition-all duration-300">
            {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`flex flex-col items-center justify-center flex-1 py-1.5 px-2 rounded-xl transition-all duration-200 active:scale-95 ${isActive
                            ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25 font-bold scale-[1.02]'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'
                            }`}
                    >
                        <Icon className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} />
                        <span className="text-[10px] sm:text-[11px] mt-0.5 tracking-tight font-semibold">{item.label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}

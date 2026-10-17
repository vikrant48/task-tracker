import React from 'react';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/supabase/user';
import { Calendar, BarChart2, History as HistoryIcon, CheckSquare } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import SignOutButton from '@/components/SignOutButton';
import MobileNav from '@/components/MobileNav';

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Cached per request, so pages calling getCurrentUser() don't hit Supabase again
    const user = await getCurrentUser();

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200 overflow-x-hidden max-w-full">
            {/* Background Glows */}
            <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-violet-600/5 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-indigo-600/5 rounded-full blur-[100px] pointer-events-none" />

            {/* Navigation Header */}
            <header className="border-b border-slate-200 dark:border-slate-900 bg-white/80 dark:bg-slate-900/40 backdrop-blur-md sticky top-0 z-50 transition-colors duration-200">
                <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        {/* Logo */}
                        <div className="flex items-center gap-1.5 sm:gap-2">
                            <div className="w-8 h-8 rounded-lg bg-linear-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                                <CheckSquare className="w-5 h-5 text-white" />
                            </div>
                            <span className="font-bold text-base sm:text-lg bg-clip-text text-transparent bg-linear-to-r from-violet-600 to-indigo-600 dark:from-violet-400 dark:to-indigo-400">
                                FocusFlow
                            </span>
                        </div>

                        {/* Navigation links (Desktop & Tablet) */}
                        <nav className="hidden sm:flex space-x-0.5 md:space-x-1">
                            <Link
                                href="/"
                                className="flex items-center gap-1 px-2.5 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-all font-semibold"
                            >
                                <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4 text-violet-500" />
                                Weekly Tracker
                            </Link>
                            <Link
                                href="/history"
                                className="flex items-center gap-1 px-2.5 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-all font-semibold"
                            >
                                <HistoryIcon className="w-3.5 h-3.5 md:w-4 md:h-4 text-indigo-500" />
                                History
                            </Link>
                            <Link
                                href="/analytics"
                                className="flex items-center gap-1 px-2.5 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-all font-semibold"
                            >
                                <BarChart2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-violet-500" />
                                Analytics
                            </Link>
                        </nav>

                        {/* User panel */}
                        <div className="flex items-center gap-2 sm:gap-3">
                            <ThemeToggle />
                            <span className="hidden lg:block text-xs text-slate-500 dark:text-slate-400 max-w-[140px] truncate">{user?.email}</span>
                            <SignOutButton />
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 lg:p-8 relative z-10 flex flex-col">
                {children}
            </main>

            {/* Bottom Nav Bar (Mobile only) */}
            <MobileNav />
            {/* Spacer for bottom nav on mobile */}
            <div className="sm:hidden h-20" />
        </div>
    );
}

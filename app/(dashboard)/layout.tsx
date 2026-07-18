import React from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { signout } from '../login/actions';
import { Calendar, BarChart2, History as HistoryIcon, LogOut, CheckSquare } from 'lucide-react';

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
            {/* Background Glows */}
            <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-violet-600/5 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-indigo-600/5 rounded-full blur-[100px] pointer-events-none" />

            {/* Navigation Header */}
            <header className="border-b border-slate-900 bg-slate-900/40 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        {/* Logo */}
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                                <CheckSquare className="w-5 h-5 text-white" />
                            </div>
                            <span className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-indigo-400">
                                FocusFlow
                            </span>
                        </div>

                        {/* Navigation links (Desktop & Tablet) */}
                        <nav className="hidden sm:flex space-x-1">
                            <Link
                                href="/"
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/50 transition-all"
                            >
                                <Calendar className="w-4 h-4" />
                                Weekly Tracker
                            </Link>
                            <Link
                                href="/history"
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/50 transition-all"
                            >
                                <HistoryIcon className="w-4 h-4" />
                                History
                            </Link>
                            <Link
                                href="/analytics"
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/50 transition-all"
                            >
                                <BarChart2 className="w-4 h-4" />
                                Analytics
                            </Link>
                        </nav>

                        {/* User panel */}
                        <div className="flex items-center gap-4">
                            <span className="hidden md:block text-xs text-slate-400">{user?.email}</span>
                            <form action={signout}>
                                <button
                                    type="submit"
                                    className="flex items-center gap-1 text-slate-400 hover:text-red-400 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-all"
                                >
                                    <LogOut className="w-4 h-4" />
                                    <span className="hidden sm:inline">Sign Out</span>
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 relative z-10 flex flex-col">
                {children}
            </main>

            {/* Bottom Nav Bar (Mobile only) */}
            <nav className="sm:hidden fixed bottom-0 left-0 right-0 border-t border-slate-900 bg-slate-900/80 backdrop-blur-lg flex justify-around py-2 z-50">
                <Link
                    href="/"
                    className="flex flex-col items-center gap-0.5 text-xs text-slate-400 hover:text-violet-400 transition-colors py-1 px-3"
                >
                    <Calendar className="w-5 h-5 text-slate-300 hover:text-violet-400 transition-colors" />
                    <span>Weekly</span>
                </Link>
                <Link
                    href="/history"
                    className="flex flex-col items-center gap-0.5 text-xs text-slate-400 hover:text-violet-400 transition-colors py-1 px-3"
                >
                    <HistoryIcon className="w-5 h-5 text-slate-300 hover:text-violet-400 transition-colors" />
                    <span>History</span>
                </Link>
                <Link
                    href="/analytics"
                    className="flex flex-col items-center gap-0.5 text-xs text-slate-400 hover:text-violet-400 transition-colors py-1 px-3"
                >
                    <BarChart2 className="w-5 h-5 text-slate-300 hover:text-violet-400 transition-colors" />
                    <span>Analytics</span>
                </Link>
            </nav>
            {/* Spacer for bottom nav on mobile */}
            <div className="sm:hidden h-16" />
        </div>
    );
}

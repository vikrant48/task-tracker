import Link from 'next/link';
import { getCurrentUser } from '@/lib/supabase/user';
import { CheckSquare } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import SignOutButton from '@/components/SignOutButton';
import MobileNav from '@/components/MobileNav';
import { NAV_ITEMS } from '@/lib/navigation';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    // Cached per request, so pages calling getCurrentUser() don't hit Supabase again
    const user = await getCurrentUser();

    return (
        <div className="min-h-dvh bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200 overflow-x-clip">
            {/* Header. Top padding keeps it clear of the status bar / notch in the installed app. */}
            <header className="sticky top-0 z-40 pt-[env(safe-area-inset-top)] border-b border-slate-200 dark:border-slate-900 bg-white/85 dark:bg-slate-950/85 backdrop-blur-md transition-colors duration-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between h-14 sm:h-16 items-center">
                    <Link href="/" className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-linear-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                            <CheckSquare className="w-5 h-5 text-white" />
                        </span>
                        <span className="font-bold text-lg bg-clip-text text-transparent bg-linear-to-r from-violet-600 to-indigo-600 dark:from-violet-400 dark:to-indigo-400">
                            FocusFlow
                        </span>
                    </Link>

                    {/* Tablet / desktop navigation (phones use the bottom bar) */}
                    <nav className="hidden sm:flex gap-1">
                        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                            <Link
                                key={href}
                                href={href}
                                className="flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-all"
                            >
                                <Icon className="w-4 h-4 text-violet-500" />
                                {label}
                            </Link>
                        ))}
                    </nav>

                    <div className="flex items-center gap-1 sm:gap-3">
                        <ThemeToggle />
                        <span className="hidden lg:block text-xs text-slate-500 dark:text-slate-400 max-w-[140px] truncate">{user?.email}</span>
                        <SignOutButton />
                    </div>
                </div>
            </header>

            {/* Bottom padding on phones leaves room for the bottom bar and the AI button above it */}
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 pt-4 pb-[calc(9rem+env(safe-area-inset-bottom))] sm:p-6 lg:p-8 flex flex-col">
                {children}
            </main>

            <MobileNav />
        </div>
    );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from '@/lib/navigation';

// Phone navigation: a bottom tab bar docked to the screen edge, clear of the home indicator
export default function MobileNav() {
    const pathname = usePathname();

    return (
        <nav
            aria-label="Main"
            className="sm:hidden fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
        >
            <div className="flex h-16">
                {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                    const isActive = pathname === href;
                    return (
                        <Link
                            key={href}
                            href={href}
                            aria-current={isActive ? 'page' : undefined}
                            className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors active:scale-95 ${isActive ? 'text-violet-600 dark:text-violet-400' : 'text-slate-500 dark:text-slate-400'}`}
                        >
                            <span className={`flex items-center justify-center w-14 h-7 rounded-full transition-colors ${isActive ? 'bg-violet-500/15' : ''}`}>
                                <Icon className="w-5 h-5" />
                            </span>
                            {label}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}

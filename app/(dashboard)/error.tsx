'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';
import { ShieldAlert } from 'lucide-react';

// Catches unexpected render errors in any dashboard page, keeping the header and navigation usable.
// Next.js 16 passes `unstable_retry` (re-fetches and re-renders the segment).
export default function DashboardError({
    error,
    unstable_retry,
}: {
    error: Error & { digest?: string };
    unstable_retry: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-12 gap-4 text-center min-h-[300px]" role="alert">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <ShieldAlert className="w-7 h-7 text-red-500" />
            </div>
            <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">Something went wrong</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                    This page hit an unexpected error. Your saved habits are safe.
                </p>
            </div>
            <button
                type="button"
                onClick={() => unstable_retry()}
                className="px-5 py-2.5 rounded-xl bg-linear-to-tr from-violet-600 to-indigo-600 text-white font-bold text-xs shadow cursor-pointer"
            >
                Try again
            </button>
        </div>
    );
}

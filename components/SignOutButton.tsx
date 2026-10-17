'use client';

import { LogOut } from 'lucide-react';
import { signout } from '@/app/login/actions';

// Clears the service worker's caches before signing out, so nothing from this
// session lingers on a shared device. Unsynced offline check-ins stay in
// localStorage (scoped per user) so they still sync on that user's next sign-in.
function clearCaches() {
    if (!('caches' in window)) return;
    caches.keys()
        .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
        .catch((err) => console.error('Could not clear caches on sign-out:', err));
}

export default function SignOutButton() {
    return (
        <form action={signout} onSubmit={clearCaches}>
            <button
                type="submit"
                className="flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 text-sm font-medium px-2 py-1.5 sm:px-3 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-all cursor-pointer select-none"
                aria-label="Sign out"
            >
                <LogOut className="w-4 h-4" />
                <span className="hidden lg:inline">Sign Out</span>
            </button>
        </form>
    );
}

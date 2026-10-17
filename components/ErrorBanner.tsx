'use client';

import { ShieldAlert, X } from 'lucide-react';

interface ErrorBannerProps {
    message: string;
    onDismiss?: () => void;
}

export default function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
    return (
        <div role="alert" className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span className="font-semibold">{message}</span>
            {onDismiss && (
                <button onClick={onDismiss} type="button" className="ml-auto text-red-500 hover:text-red-600 cursor-pointer" aria-label="Dismiss error">
                    <X className="w-4 h-4" />
                </button>
            )}
        </div>
    );
}

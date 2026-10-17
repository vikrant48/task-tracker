'use client';

import { useEffect, type ReactNode } from 'react';

interface SheetProps {
    titleId: string;
    onClose: () => void;
    role?: 'dialog' | 'alertdialog';
    // Width on tablet/desktop, where the sheet becomes a centred dialog
    size?: 'sm' | 'lg';
    children: ReactNode;
}

// Bottom sheet on phones (thumb-reachable, clear of the home indicator), centred dialog on larger screens.
// Closes on Escape or a tap on the backdrop, and stops the page behind it from scrolling.
export default function Sheet({ titleId, onClose, role = 'dialog', size = 'sm', children }: SheetProps) {
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm sm:p-4"
            onClick={onClose}
        >
            <div
                role={role}
                aria-modal="true"
                aria-labelledby={titleId}
                onClick={(e) => e.stopPropagation()}
                className={`w-full ${size === 'lg' ? 'sm:max-w-lg' : 'sm:max-w-sm'} max-h-[90dvh] overflow-y-auto bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl px-5 pt-3 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-6 shadow-2xl`}
            >
                <div aria-hidden="true" className="sm:hidden mx-auto mb-4 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
                {children}
            </div>
        </div>
    );
}

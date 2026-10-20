'use client';

import { useState } from 'react';
import { format, parse } from 'date-fns';
import { BellRing, Loader2 } from 'lucide-react';
import Sheet from '@/components/Sheet';
import { pushSupported } from '@/hooks/usePushReminders';

interface ReminderSheetProps {
    enabled: boolean;
    time: string;
    onEnable: (time: string) => Promise<void>;
    onDisable: () => Promise<void>;
    // Show a progress notification right now (works without push)
    onTestNow: () => void;
    onClose: () => void;
}

// Daily reminder at a chosen time, delivered by push even when the app is closed
export default function ReminderSheet({ enabled, time, onEnable, onDisable, onTestNow, onClose }: ReminderSheetProps) {
    const [draftTime, setDraftTime] = useState(time);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);
    const supported = pushSupported();

    const run = async (action: () => Promise<void>) => {
        setBusy(true);
        setError(null);
        setSaved(false);
        try {
            await action();
            setSaved(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
        } finally {
            setBusy(false);
        }
    };

    const buttonBase = 'h-12 sm:h-10 px-4 rounded-xl text-sm font-bold cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2';

    return (
        <Sheet titleId="reminder-title" onClose={onClose}>
            <h3 id="reminder-title" className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BellRing className="w-5 h-5 text-violet-500" />
                Daily reminder
            </h3>

            {supported ? (
                <>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        One nudge a day with what&apos;s left, even when the app is closed. Skipped when you&apos;ve done everything.
                    </p>
                    <label className="mt-5 flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Remind me at</span>
                        <input
                            type="time"
                            value={draftTime}
                            onChange={(e) => setDraftTime(e.target.value)}
                            className="h-11 px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                    </label>
                    <p className="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300" role="status">
                        {enabled ? `On · every day at ${format(parse(time, 'HH:mm', new Date()), 'h:mm a')}` : 'Off'}
                    </p>
                </>
            ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                    Scheduled reminders need notifications support. On iPhone, add FocusFlow to your Home Screen (Share → Add to Home Screen) and open it from there.
                </p>
            )}

            {error && <p role="alert" className="mt-3 text-sm font-semibold text-rose-600 dark:text-rose-400">{error}</p>}
            {saved && !error && <p className="mt-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400">Saved.</p>}

            <div className="flex flex-col-reverse sm:flex-row sm:flex-wrap justify-end gap-2 mt-6">
                <button type="button" onClick={onTestNow} className={`${buttonBase} text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800`}>
                    Notify me now
                </button>
                {supported && enabled && (
                    <button type="button" disabled={busy} onClick={() => run(onDisable)} className={`${buttonBase} text-rose-600 dark:text-rose-400 bg-rose-500/10`}>
                        Turn off
                    </button>
                )}
                {supported && (
                    <button
                        type="button"
                        disabled={busy || !draftTime || (enabled && draftTime === time)}
                        onClick={() => run(() => onEnable(draftTime))}
                        className={`${buttonBase} text-white bg-linear-to-r from-violet-600 to-indigo-600`}
                    >
                        {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                        {enabled ? 'Update time' : 'Turn on'}
                    </button>
                )}
            </div>
        </Sheet>
    );
}

'use client';

import { useState, type FormEvent } from 'react';
import { Users, X, Loader2 } from 'lucide-react';
import type { Task, TaskShare } from '@/lib/types';
import Sheet from '@/components/Sheet';

interface ShareHabitDialogProps {
    task: Task;
    shares: TaskShare[];
    // Each resolves to an error message, or null on success
    onShare: (email: string) => Promise<string | null>;
    onRemoveShare: (shareId: string) => Promise<string | null>;
    onClose: () => void;
}

export default function ShareHabitDialog({ task, shares, onShare, onRemoveShare, onClose }: ShareHabitDialogProps) {
    const [email, setEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!email.trim() || submitting) return;
        setSubmitting(true);
        setError(null);
        const shareError = await onShare(email.trim().toLowerCase());
        setSubmitting(false);
        if (shareError) setError(shareError);
        else setEmail('');
    };

    const handleRemove = async (shareId: string) => {
        setError(await onRemoveShare(shareId));
    };

    return (
        <Sheet titleId="share-task-title" onClose={onClose}>
            <div className="flex justify-between items-start gap-3 mb-4">
                <div className="min-w-0">
                    <h3 id="share-task-title" className="text-lg font-bold text-slate-950 dark:text-white flex items-center gap-2">
                        <Users className="w-5 h-5 text-violet-500" />
                        Share Habit
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 truncate">{task.name}</p>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {shares.length > 0 && (
                <div className="mb-5">
                    <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400 dark:text-slate-500 block mb-2">Shared with</span>
                    <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
                        {shares.map((share) => (
                            <div key={share.id} className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-950 pl-3 border border-slate-200 dark:border-slate-800 rounded-xl text-sm">
                                <span className="text-slate-700 dark:text-slate-300 truncate">{share.shared_with_email}</span>
                                <button
                                    onClick={() => handleRemove(share.id)}
                                    type="button"
                                    className="h-11 px-3 shrink-0 text-xs text-rose-500 hover:text-rose-600 font-bold cursor-pointer"
                                >
                                    Stop sharing
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <label htmlFor="collaborator-email" className="text-xs uppercase font-extrabold tracking-wider text-slate-400 dark:text-slate-500">
                    Invite by email
                </label>
                <input
                    id="collaborator-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="partner@gmail.com"
                    className="h-12 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4 w-full rounded-xl text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                />

                {error && (
                    <span role="alert" className="text-rose-500 dark:text-rose-400 text-sm font-semibold leading-tight">{error}</span>
                )}

                <button
                    type="submit"
                    disabled={submitting || !email.trim()}
                    className="h-12 sm:h-10 mt-1 rounded-xl bg-linear-to-tr from-violet-600 to-indigo-600 text-white font-bold text-sm shadow transition-all cursor-pointer disabled:opacity-40 flex items-center justify-center"
                >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send invite'}
                </button>
            </form>
        </Sheet>
    );
}

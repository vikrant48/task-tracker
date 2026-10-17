'use client';

import { useState, type FormEvent } from 'react';
import { Users, X, Loader2 } from 'lucide-react';
import type { Task, TaskShare } from '@/lib/types';

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
        <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
        >
            <div role="dialog" aria-modal="true" aria-labelledby="share-task-title" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 id="share-task-title" className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-1.5">
                            <Users className="w-4 h-4 text-violet-500" />
                            Share Habit
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            Habit: <span className="font-semibold text-slate-700 dark:text-slate-200">{task.name}</span>
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {shares.length > 0 && (
                    <div className="mb-4">
                        <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 dark:text-slate-500 block mb-2">Active Collaborators</span>
                        <div className="flex flex-col gap-2 max-h-28 overflow-y-auto pr-1">
                            {shares.map((share) => (
                                <div key={share.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs">
                                    <span className="text-slate-700 dark:text-slate-300 truncate mr-2">{share.shared_with_email}</span>
                                    <button
                                        onClick={() => handleRemove(share.id)}
                                        type="button"
                                        className="text-[10px] text-rose-500 hover:text-rose-600 font-bold hover:underline cursor-pointer"
                                    >
                                        Stop Share
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                    <div>
                        <label htmlFor="collaborator-email" className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 dark:text-slate-500 block mb-2">
                            Invite Collaborator
                        </label>
                        <input
                            id="collaborator-email"
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="partner@gmail.com"
                            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-2.5 w-full rounded-xl text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-transparent transition-all"
                        />
                    </div>

                    {error && (
                        <span role="alert" className="text-rose-500 dark:text-rose-400 text-xs font-semibold leading-tight">{error}</span>
                    )}

                    <div className="flex justify-end gap-2 mt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all select-none cursor-pointer"
                        >
                            Close
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || !email.trim()}
                            className="px-4 py-2 rounded-xl bg-linear-to-tr from-violet-600 to-indigo-600 text-white font-bold text-xs shadow hover:from-violet-500 hover:to-indigo-500 transition-all select-none cursor-pointer disabled:opacity-40"
                        >
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Invite'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

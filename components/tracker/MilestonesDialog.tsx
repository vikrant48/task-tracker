/* eslint-disable @next/next/no-img-element -- static badge artwork */
'use client';

import { Trophy, X } from 'lucide-react';
import { MILESTONES } from '@/lib/milestones';

export default function MilestonesDialog({ onClose }: { onClose: () => void }) {
    return (
        <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
        >
            <div role="dialog" aria-modal="true" aria-labelledby="milestones-title" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
                    <h3 id="milestones-title" className="text-lg font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-amber-500 fill-amber-500" />
                        Streak Milestones & Badges
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                    Maintain consistent daily completions to unlock 3D streak badges for your routine habits!
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    {MILESTONES.map((m) => (
                        <div key={m.days} className={`flex flex-col items-center text-center border p-4 rounded-2xl ${m.card}`}>
                            <img src={m.image} alt="" className="w-14 h-14 object-contain mb-2 drop-shadow-md" />
                            <span className={`text-xs font-extrabold ${m.text}`}>{m.name}</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-semibold">{m.tier} Milestone</span>
                        </div>
                    ))}
                </div>

                <div className="flex justify-end">
                    <button
                        type="button"
                        autoFocus
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-extrabold text-xs shadow hover:bg-slate-800 dark:hover:bg-slate-100 transition-all select-none cursor-pointer"
                    >
                        Got it
                    </button>
                </div>
            </div>
        </div>
    );
}

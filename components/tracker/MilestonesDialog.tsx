/* eslint-disable @next/next/no-img-element -- static badge artwork */
'use client';

import { Trophy, X } from 'lucide-react';
import { MILESTONES } from '@/lib/milestones';
import Sheet from '@/components/Sheet';

export default function MilestonesDialog({ onClose }: { onClose: () => void }) {
    return (
        <Sheet titleId="milestones-title" size="lg" onClose={onClose}>
            <div className="flex items-center justify-between gap-3">
                <h3 id="milestones-title" className="text-lg font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-500 fill-amber-500" />
                    Streak Milestones
                </h3>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-5 leading-relaxed">
                Complete a habit on consecutive days to unlock these badges.
            </p>

            {/* Compact rows on phones, cards side by side on larger screens */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {MILESTONES.map((m) => (
                    <div key={m.days} className={`flex sm:flex-col items-center gap-4 sm:gap-2 sm:text-center border p-3 sm:p-4 rounded-2xl ${m.card}`}>
                        <img src={m.image} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />
                        <div>
                            <div className={`text-base font-extrabold ${m.text}`}>{m.name}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                                {m.tier} · {m.days} days in a row
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <button
                type="button"
                autoFocus
                onClick={onClose}
                className="w-full sm:w-auto sm:float-right mt-5 h-12 sm:h-10 px-6 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold text-sm shadow transition-all cursor-pointer"
            >
                Got it
            </button>
        </Sheet>
    );
}

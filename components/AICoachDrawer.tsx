'use client';

import { useState, type FormEvent } from 'react';
import { Sparkles, Mic, Send, X, Plus, CheckCircle2, Loader2, Bot, Target, MessageSquare, ShieldAlert } from 'lucide-react';
import type { CoachHabitStat } from '@/lib/ai-schemas';
import { useDictation, appendSpoken } from '@/hooks/useDictation';
import MicButton from '@/components/MicButton';

interface Task {
    id: string;
    name: string;
    category?: string;
}

interface AICoachDrawerProps {
    tasks: Task[];
    // Real per-habit numbers sent to the AI coach
    buildCoachStats: () => CoachHabitStat[];
    // Resolves to whether the habits were saved
    onAddTasksBatch?: (newTasks: { name: string; category: string }[]) => Promise<boolean>;
    // Marks a habit done for today (never un-checks). Returns false for unknown ids.
    onMarkTaskDone?: (taskId: string) => boolean;
}

// Limits mirror the /api/ai request schema so valid input is never rejected
const MAX_TASKS = 100;
const MAX_NAME_LENGTH = 120;
const MAX_INPUT_LENGTH = 300;

async function postAI(body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
    const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
}

export default function AICoachDrawer({ tasks, buildCoachStats, onAddTasksBatch, onMarkTaskDone }: AICoachDrawerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'log' | 'breakdown' | 'coach'>('log');

    // Natural Log State
    const [logInput, setLogInput] = useState('');
    const [logLoading, setLogLoading] = useState(false);
    const [logFeedback, setLogFeedback] = useState<string | null>(null);

    // Goal Breakdown State
    const [goalInput, setGoalInput] = useState('');
    const [breakdownLoading, setBreakdownLoading] = useState(false);
    const [generatedHabits, setGeneratedHabits] = useState<{ name: string; category: string }[]>([]);
    const [addSuccessMsg, setAddSuccessMsg] = useState<string | null>(null);
    const [breakdownError, setBreakdownError] = useState<string | null>(null);
    const [addingHabits, setAddingHabits] = useState(false);

    // AI Coach State
    const [coachAdvice, setCoachAdvice] = useState<string | null>(null);
    const [coachError, setCoachError] = useState<string | null>(null);
    const [coachLoading, setCoachLoading] = useState(false);

    // Voice input into whichever field's microphone was tapped
    const dictation = useDictation<'log' | 'goal'>();
    const stopDictation = dictation.stop;
    const toggleDictation = (target: 'log' | 'goal') =>
        dictation.toggle(target, (text) => (target === 'log' ? setLogInput : setGoalInput)((prev) => appendSpoken(prev, text)));
    const listeningFor = dictation.listeningFor;

    const switchTab = (tab: typeof activeTab) => {
        stopDictation();
        setActiveTab(tab);
    };

    const closeDrawer = () => {
        stopDictation();
        setIsOpen(false);
    };

    // Handle Natural Language Logging
    const handleNaturalLog = async (e: FormEvent) => {
        e.preventDefault();
        if (!logInput.trim() || logLoading) return;

        setLogLoading(true);
        setLogFeedback(null);

        try {
            const { ok, data } = await postAI({
                action: 'natural_log',
                payload: {
                    input: logInput.trim().slice(0, MAX_INPUT_LENGTH),
                    tasks: tasks.slice(0, MAX_TASKS).map((t) => ({ id: t.id, name: t.name.slice(0, MAX_NAME_LENGTH) })),
                },
            });

            if (!ok) {
                setLogFeedback(typeof data.error === 'string' ? data.error : 'Failed to process natural log. Please try again.');
                return;
            }

            // Only accept ids of the user's actual habits (the model can hallucinate ids), de-duplicated
            const knownIds = new Set(tasks.map((t) => t.id));
            const matchedIds: string[] = Array.isArray(data.matchedTaskIds)
                ? Array.from(new Set(data.matchedTaskIds.filter((id: unknown): id is string => typeof id === 'string' && knownIds.has(id))))
                : [];

            if (matchedIds.length > 0 && onMarkTaskDone) {
                const count = matchedIds.filter((taskId) => onMarkTaskDone(taskId)).length;
                const summary = `Marked ${count} habit${count !== 1 ? 's' : ''} as done for today.`;
                const explanation = typeof data.explanation === 'string' ? data.explanation : '';
                setLogFeedback(explanation ? `${summary} ${explanation}` : summary);
                setLogInput('');
            } else {
                setLogFeedback('Could not match any active habits. Try rephrasing!');
            }
        } catch (err) {
            console.error('Error processing natural log:', err);
            setLogFeedback('Failed to process natural log. Please try again.');
        } finally {
            setLogLoading(false);
        }
    };

    // Handle Goal Breakdown
    const handleGoalBreakdown = async (e: FormEvent) => {
        e.preventDefault();
        if (!goalInput.trim() || breakdownLoading) return;

        setBreakdownLoading(true);
        setGeneratedHabits([]);
        setAddSuccessMsg(null);
        setBreakdownError(null);

        try {
            const { ok, data } = await postAI({
                action: 'breakdown',
                payload: { goal: goalInput.trim().slice(0, MAX_INPUT_LENGTH) },
            });

            if (ok && Array.isArray(data.habits) && data.habits.length > 0) {
                setGeneratedHabits(data.habits as { name: string; category: string }[]);
            } else {
                setBreakdownError(
                    typeof data.error === 'string' ? data.error : 'Could not break down that goal. Please try a different prompt!'
                );
            }
        } catch (err) {
            console.error('Error generating habits:', err);
            setBreakdownError('Could not reach the AI service. Please try again.');
        } finally {
            setBreakdownLoading(false);
        }
    };

    // Handle Add All Breakdown Habits
    const handleAddAllHabits = async () => {
        if (!generatedHabits.length || !onAddTasksBatch || addingHabits) return;
        setAddingHabits(true);
        setBreakdownError(null);
        try {
            const saved = await onAddTasksBatch(generatedHabits);
            if (saved) {
                setAddSuccessMsg(`Successfully added ${generatedHabits.length} micro-habits!`);
                setGeneratedHabits([]);
                setGoalInput('');
            } else {
                setBreakdownError('Could not save these habits. Please try again.');
            }
        } finally {
            setAddingHabits(false);
        }
    };

    // Handle Ask AI Coach
    const fetchCoachAdvice = async () => {
        if (coachLoading) return;
        setCoachLoading(true);
        setCoachError(null);
        try {
            const { ok, data } = await postAI({
                action: 'coach',
                payload: { habits: buildCoachStats() },
            });
            if (ok && typeof data.result === 'string') {
                setCoachAdvice(data.result);
            } else {
                setCoachError(typeof data.error === 'string' ? data.error : 'Could not get coaching advice. Please try again.');
            }
        } catch (e) {
            console.error('Error fetching coach advice:', e);
            setCoachError('Could not reach the AI service. Please try again.');
        } finally {
            setCoachLoading(false);
        }
    };

    return (
        <>
            {/* Floating trigger: round icon above the bottom bar on phones, labelled pill on larger screens */}
            <button
                onClick={() => setIsOpen(true)}
                type="button"
                aria-label="Open FocusFlow AI assistant"
                className="fixed z-30 right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] sm:right-6 sm:bottom-6 w-14 h-14 sm:w-auto sm:h-auto sm:px-5 sm:py-3 flex items-center justify-center gap-2 bg-linear-to-tr from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-extrabold text-sm rounded-full shadow-lg shadow-violet-600/30 border border-violet-400/40 active:scale-95 transition-all cursor-pointer group"
            >
                <Sparkles className="w-6 h-6 sm:w-4 sm:h-4 text-amber-300 group-hover:rotate-12 transition-transform" />
                <span className="hidden sm:inline">FocusFlow AI</span>
            </button>

            {/* Slide-over Drawer / Mobile Bottom Sheet Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-100 flex flex-col justify-end sm:justify-start sm:items-end bg-slate-950/75 backdrop-blur-sm"
                    onKeyDown={(e) => { if (e.key === 'Escape') closeDrawer(); }}
                >
                    {/* Main Drawer Panel */}
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="ai-drawer-title"
                        className="w-full max-w-md bg-white dark:bg-slate-950 border-t sm:border-t-0 sm:border-l border-slate-200 dark:border-slate-800 h-[92dvh] sm:h-full rounded-t-3xl sm:rounded-none flex flex-col shadow-2xl overflow-hidden"
                    >

                        {/* Mobile Handle Pill */}
                        <div className="pt-2 pb-1 bg-slate-50 dark:bg-slate-900/40 sm:hidden flex justify-center">
                            <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full" />
                        </div>

                        {/* Drawer Header */}
                        <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-slate-900 flex items-center justify-between bg-slate-50 dark:bg-slate-900/40">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-xl bg-linear-to-tr from-violet-600 to-indigo-600 text-white shadow-md">
                                    <Bot className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 id="ai-drawer-title" className="font-extrabold text-sm text-slate-800 dark:text-white">FocusFlow AI Assistant</h3>
                                    <span className="text-xs text-violet-600 dark:text-violet-400 font-bold">Powered by Groq</span>
                                </div>
                            </div>
                            <button
                                type="button"
                                autoFocus
                                onClick={closeDrawer}
                                aria-label="Close AI assistant"
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Navigation Tabs */}
                        <div className="flex border-b border-slate-200 dark:border-slate-900 bg-slate-100/50 dark:bg-slate-950/50 p-1 gap-1">
                            <button
                                onClick={() => switchTab('log')}
                                className={`flex-1 h-11 text-sm font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${activeTab === 'log'
                                    ? 'bg-white dark:bg-slate-900 text-violet-600 dark:text-violet-400 shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                                    }`}
                            >
                                <Mic className="w-3.5 h-3.5" />
                                Quick Log
                            </button>

                            <button
                                onClick={() => switchTab('breakdown')}
                                className={`flex-1 h-11 text-sm font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${activeTab === 'breakdown'
                                    ? 'bg-white dark:bg-slate-900 text-violet-600 dark:text-violet-400 shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                                    }`}
                            >
                                <Target className="w-3.5 h-3.5" />
                                Goals
                            </button>

                            <button
                                onClick={() => {
                                    switchTab('coach');
                                    if (!coachAdvice) fetchCoachAdvice();
                                }}
                                className={`flex-1 h-11 text-sm font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${activeTab === 'coach'
                                    ? 'bg-white dark:bg-slate-900 text-violet-600 dark:text-violet-400 shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                                    }`}
                            >
                                <MessageSquare className="w-3.5 h-3.5" />
                                Coach
                            </button>
                        </div>

                        {/* Tab Contents */}
                        <div className="flex-1 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-4">

                            {/* TAB 1: Natural Language & Voice Logging */}
                            {activeTab === 'log' && (
                                <div className="space-y-4">
                                    <div className="bg-violet-500/10 border border-violet-500/20 p-3 rounded-xl text-xs text-violet-700 dark:text-violet-300">
                                        🗣️ <strong>Speak or Type</strong>: Describe what habits you finished today (e.g. <em>&ldquo;Completed reading and drank 2L water&rdquo;</em>) and AI will check them off automatically!
                                    </div>

                                    <form onSubmit={handleNaturalLog}>
                                        <div className="relative flex items-center">
                                            <input
                                                type="text"
                                                aria-label="What did you complete today?"
                                                enterKeyHint="send"
                                                value={logInput}
                                                onChange={(e) => setLogInput(e.target.value)}
                                                placeholder="e.g. Read and drank water…"
                                                className="w-full min-w-0 h-12 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-3.5 pr-24 text-sm font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-violet-500"
                                            />
                                            <div className="absolute right-1.5 flex items-center gap-1">
                                                <MicButton listening={listeningFor === 'log'} onClick={() => toggleDictation('log')} />
                                                <button
                                                    type="submit"
                                                    aria-label="Log habits"
                                                    disabled={logLoading || !logInput.trim()}
                                                    className="w-9 h-9 flex items-center justify-center bg-violet-600 hover:bg-violet-500 text-white rounded-lg disabled:opacity-40 transition-all cursor-pointer"
                                                >
                                                    {logLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>
                                    </form>

                                    {logFeedback && (
                                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs rounded-xl flex items-center gap-2">
                                            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                                            <span>{logFeedback}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB 2: AI Goal Breakdown */}
                            {activeTab === 'breakdown' && (
                                <div className="space-y-4">
                                    <div className="bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-xl text-xs text-indigo-700 dark:text-indigo-300">
                                        🎯 Enter any big goal (e.g. <em>&ldquo;Prepare for Marathon&rdquo;</em> or <em>&ldquo;Learn Next.js&rdquo;</em>) and AI will convert it into 3–4 daily micro-habits!
                                    </div>

                                    {/* min-w-0 lets the input shrink, so the Generate button always stays on screen */}
                                    <form onSubmit={handleGoalBreakdown} className="flex items-center gap-2">
                                        <div className="relative flex-1 min-w-0 flex items-center">
                                            <input
                                                type="text"
                                                aria-label="Your goal"
                                                enterKeyHint="go"
                                                value={goalInput}
                                                onChange={(e) => setGoalInput(e.target.value)}
                                                placeholder="Your goal…"
                                                className="w-full min-w-0 h-12 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-3.5 pr-12 text-sm font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                                            />
                                            <div className="absolute right-1.5">
                                                <MicButton listening={listeningFor === 'goal'} onClick={() => toggleDictation('goal')} />
                                            </div>
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={breakdownLoading || !goalInput.trim()}
                                            className="h-12 shrink-0 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold disabled:opacity-40 transition-all flex items-center gap-1.5 cursor-pointer"
                                        >
                                            {breakdownLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                            Generate
                                        </button>
                                    </form>

                                    {generatedHabits.length > 0 && (
                                        <div className="space-y-2 pt-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Suggested Daily Micro-Habits:</span>
                                                <button
                                                    onClick={handleAddAllHabits}
                                                    disabled={addingHabits}
                                                    className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {addingHabits ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                                                    Add All to Tracker
                                                </button>
                                            </div>

                                            <div className="space-y-1.5">
                                                {generatedHabits.map((h, i) => (
                                                    <div key={i} className="p-2.5 bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between text-xs">
                                                        <span className="font-bold text-slate-800 dark:text-slate-200">{h.name}</span>
                                                        <span className="text-[11px] font-extrabold uppercase px-2 py-0.5 rounded bg-violet-500/10 text-violet-600 dark:text-violet-400">{h.category}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {addSuccessMsg && (
                                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs rounded-xl flex items-center gap-2">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                            <span>{addSuccessMsg}</span>
                                        </div>
                                    )}

                                    {breakdownError && (
                                        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 text-xs rounded-xl flex items-center gap-2">
                                            <ShieldAlert className="w-4 h-4 shrink-0" />
                                            <span>{breakdownError}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB 3: AI Coach Advice */}
                            {activeTab === 'coach' && (
                                <div className="space-y-4">
                                    <div className="p-4 bg-linear-to-tr from-violet-600/10 via-indigo-600/10 to-emerald-500/10 border border-violet-500/20 rounded-2xl space-y-3">
                                        <div className="flex items-center gap-2">
                                            <Sparkles className="w-4 h-4 text-amber-500" />
                                            <h4 className="font-extrabold text-xs text-slate-800 dark:text-white">Personal Behavioral Insight</h4>
                                        </div>

                                        {coachLoading ? (
                                            <div className="flex items-center gap-2 text-xs text-slate-500 py-4">
                                                <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
                                                <span>Analyzing completion patterns...</span>
                                            </div>
                                        ) : coachError ? (
                                            <p className="text-xs text-red-700 dark:text-red-400 font-medium leading-relaxed flex items-center gap-2">
                                                <ShieldAlert className="w-4 h-4 shrink-0" />
                                                {coachError}
                                            </p>
                                        ) : (
                                            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed whitespace-pre-line">
                                                {coachAdvice || 'Complete your habits daily to get customized AI insights!'}
                                            </p>
                                        )}

                                        <button
                                            onClick={fetchCoachAdvice}
                                            disabled={coachLoading}
                                            className="w-full py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                        >
                                            Refresh Coaching Advice
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            )}
        </>
    );
}

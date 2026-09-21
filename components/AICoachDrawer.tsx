'use client';

import React, { useState } from 'react';
import { Sparkles, Mic, MicOff, Send, X, Plus, CheckCircle2, Loader2, Bot, Target, MessageSquare } from 'lucide-react';

interface Task {
    id: string;
    name: string;
    category?: string;
}

interface AICoachDrawerProps {
    tasks: Task[];
    userId: string | null;
    onAddTasksBatch?: (newTasks: { name: string; category: string }[]) => Promise<void>;
    onToggleTaskMatch?: (taskId: string) => void;
}

export default function AICoachDrawer({ tasks, userId, onAddTasksBatch, onToggleTaskMatch }: AICoachDrawerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'log' | 'breakdown' | 'coach'>('log');

    // Natural Log State
    const [logInput, setLogInput] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [logLoading, setLogLoading] = useState(false);
    const [logFeedback, setLogFeedback] = useState<string | null>(null);

    // Goal Breakdown State
    const [goalInput, setGoalInput] = useState('');
    const [breakdownLoading, setBreakdownLoading] = useState(false);
    const [generatedHabits, setGeneratedHabits] = useState<{ name: string; category: string }[]>([]);
    const [addSuccessMsg, setAddSuccessMsg] = useState<string | null>(null);

    // AI Coach State
    const [coachAdvice, setCoachAdvice] = useState<string | null>(null);
    const [coachLoading, setCoachLoading] = useState(false);

    // Handle Voice Dictation using Web Speech API
    const handleVoiceToggle = () => {
        if (typeof window === 'undefined') return;
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

        if (!SpeechRecognition) {
            alert('Voice dictation is not supported on this browser. Please type your message.');
            return;
        }

        if (isListening) {
            setIsListening(false);
            return;
        }

        try {
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'en-US';

            recognition.onstart = () => setIsListening(true);
            recognition.onend = () => setIsListening(false);
            recognition.onerror = () => setIsListening(false);

            recognition.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                setLogInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
            };

            recognition.start();
        } catch (e) {
            console.error('Speech recognition error:', e);
            setIsListening(false);
        }
    };

    // Handle Natural Language Logging
    const handleNaturalLog = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!logInput.trim() || logLoading) return;

        setLogLoading(true);
        setLogFeedback(null);

        try {
            const res = await fetch('/api/ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'natural_log',
                    payload: {
                        input: logInput,
                        tasks: tasks.map(t => ({ id: t.id, name: t.name })),
                    },
                }),
            });

            const data = await res.json();
            if (data.matchedTaskIds && Array.isArray(data.matchedTaskIds)) {
                let count = 0;
                data.matchedTaskIds.forEach((taskId: string) => {
                    if (onToggleTaskMatch) {
                        onToggleTaskMatch(taskId);
                        count++;
                    }
                });
                setLogFeedback(data.explanation || `Successfully completed ${count} habit${count !== 1 ? 's' : ''}!`);
                setLogInput('');
            } else {
                setLogFeedback('Could not match any active habits. Try rephrasing!');
            }
        } catch (err) {
            setLogFeedback('Failed to process natural log. Please try again.');
        } finally {
            setLogLoading(false);
        }
    };

    // Handle Goal Breakdown
    const handleGoalBreakdown = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!goalInput.trim() || breakdownLoading) return;

        setBreakdownLoading(true);
        setGeneratedHabits([]);
        setAddSuccessMsg(null);

        try {
            const res = await fetch('/api/ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'breakdown',
                    payload: { goal: goalInput },
                }),
            });

            const data = await res.json();
            if (data.habits && Array.isArray(data.habits)) {
                setGeneratedHabits(data.habits);
            } else {
                alert('Could not break down goal. Please try a different prompt!');
            }
        } catch (err) {
            console.error('Error generating habits:', err);
        } finally {
            setBreakdownLoading(false);
        }
    };

    // Handle Add All Breakdown Habits
    const handleAddAllHabits = async () => {
        if (!generatedHabits.length || !onAddTasksBatch) return;
        try {
            await onAddTasksBatch(generatedHabits);
            setAddSuccessMsg(`Successfully added ${generatedHabits.length} micro-habits!`);
            setGeneratedHabits([]);
            setGoalInput('');
        } catch (e) {
            console.error('Error adding micro habits:', e);
        }
    };

    // Handle Ask AI Coach
    const fetchCoachAdvice = async () => {
        if (coachLoading) return;
        setCoachLoading(true);
        try {
            const res = await fetch('/api/ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'coach',
                    payload: {
                        tasks: tasks.map(t => t.name),
                        completionStats: { totalActive: tasks.length },
                    },
                }),
            });
            const data = await res.json();
            setCoachAdvice(data.result || 'Keep focusing on small 1% daily improvements!');
        } catch (e) {
            setCoachAdvice('Focus on consistency! Complete 1 micro-habit today to build momentum.');
        } finally {
            setCoachLoading(false);
        }
    };

    return (
        <>
            {/* Floating Glassmorphic Trigger Button */}
            <div className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40">
                <button
                    onClick={() => setIsOpen(true)}
                    type="button"
                    className="flex items-center gap-2 bg-gradient-to-tr from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-extrabold text-xs sm:text-sm px-4 py-3 rounded-full shadow-lg shadow-violet-600/30 border border-violet-400/40 backdrop-blur active:scale-95 transition-all cursor-pointer group"
                >
                    <Sparkles className="w-4 h-4 text-amber-300 animate-pulse group-hover:rotate-12 transition-transform" />
                    <span>FocusFlow AI</span>
                </button>
            </div>

            {/* Slide-over Drawer / Mobile Bottom Sheet Backdrop */}
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex flex-col justify-end sm:justify-start sm:items-end bg-slate-950/75 backdrop-blur-sm animate-fade-in">
                    {/* Main Drawer Panel */}
                    <div className="w-full max-w-md bg-white dark:bg-slate-950 border-t sm:border-t-0 sm:border-l border-slate-200 dark:border-slate-800 h-[92vh] sm:h-full rounded-t-3xl sm:rounded-none flex flex-col shadow-2xl animate-slide-in-right overflow-hidden">

                        {/* Mobile Handle Pill */}
                        <div className="pt-2 pb-1 bg-slate-50 dark:bg-slate-900/40 sm:hidden flex justify-center">
                            <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full" />
                        </div>

                        {/* Drawer Header */}
                        <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-slate-900 flex items-center justify-between bg-slate-50 dark:bg-slate-900/40">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-md">
                                    <Bot className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-sm text-slate-850 dark:text-white">FocusFlow AI Assistant</h3>
                                    <span className="text-[10px] text-violet-600 dark:text-violet-400 font-bold">Powered by Groq Llama 3</span>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Navigation Tabs */}
                        <div className="flex border-b border-slate-200 dark:border-slate-900 bg-slate-100/50 dark:bg-slate-950/50 p-1 gap-1">
                            <button
                                onClick={() => setActiveTab('log')}
                                className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${activeTab === 'log'
                                    ? 'bg-white dark:bg-slate-900 text-violet-600 dark:text-violet-400 shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                                    }`}
                            >
                                <Mic className="w-3.5 h-3.5" />
                                Quick Log
                            </button>

                            <button
                                onClick={() => setActiveTab('breakdown')}
                                className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${activeTab === 'breakdown'
                                    ? 'bg-white dark:bg-slate-900 text-violet-600 dark:text-violet-400 shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                                    }`}
                            >
                                <Target className="w-3.5 h-3.5" />
                                Goal Breakdown
                            </button>

                            <button
                                onClick={() => {
                                    setActiveTab('coach');
                                    if (!coachAdvice) fetchCoachAdvice();
                                }}
                                className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${activeTab === 'coach'
                                    ? 'bg-white dark:bg-slate-900 text-violet-600 dark:text-violet-400 shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                                    }`}
                            >
                                <MessageSquare className="w-3.5 h-3.5" />
                                AI Coach
                            </button>
                        </div>

                        {/* Tab Contents */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">

                            {/* TAB 1: Natural Language & Voice Logging */}
                            {activeTab === 'log' && (
                                <div className="space-y-4">
                                    <div className="bg-violet-500/10 border border-violet-500/20 p-3 rounded-xl text-xs text-violet-700 dark:text-violet-300">
                                        🗣️ <strong>Speak or Type</strong>: Describe what habits you finished today (e.g. <em>"Completed reading and drank 2L water"</em>) and AI will check them off automatically!
                                    </div>

                                    <form onSubmit={handleNaturalLog} className="space-y-3">
                                        <div className="relative flex items-center">
                                            <input
                                                type="text"
                                                value={logInput}
                                                onChange={(e) => setLogInput(e.target.value)}
                                                placeholder="e.g. Completed 10 pushups and drank water..."
                                                className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-3 pr-20 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-violet-500"
                                            />
                                            <div className="absolute right-2 flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={handleVoiceToggle}
                                                    className={`p-2 rounded-lg transition-colors cursor-pointer ${isListening
                                                        ? 'bg-red-500 text-white animate-pulse'
                                                        : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300'
                                                        }`}
                                                    title={isListening ? 'Listening...' : 'Voice Dictation'}
                                                >
                                                    {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                                                </button>
                                                <button
                                                    type="submit"
                                                    disabled={logLoading || !logInput.trim()}
                                                    className="p-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg disabled:opacity-40 transition-all cursor-pointer"
                                                >
                                                    {logLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                                </button>
                                            </div>
                                        </div>
                                    </form>

                                    {logFeedback && (
                                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs rounded-xl flex items-center gap-2">
                                            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-500" />
                                            <span>{logFeedback}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB 2: AI Goal Breakdown */}
                            {activeTab === 'breakdown' && (
                                <div className="space-y-4">
                                    <div className="bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-xl text-xs text-indigo-700 dark:text-indigo-300">
                                        🎯 Enter any big goal (e.g. <em>"Prepare for Marathon"</em> or <em>"Learn Next.js"</em>) and AI will convert it into 3–4 daily micro-habits!
                                    </div>

                                    <form onSubmit={handleGoalBreakdown} className="flex gap-2">
                                        <input
                                            type="text"
                                            value={goalInput}
                                            onChange={(e) => setGoalInput(e.target.value)}
                                            placeholder="Enter high-level goal..."
                                            className="flex-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                                        />
                                        <button
                                            type="submit"
                                            disabled={breakdownLoading || !goalInput.trim()}
                                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2.5 rounded-xl text-xs font-bold disabled:opacity-40 transition-all flex items-center gap-1 cursor-pointer"
                                        >
                                            {breakdownLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                            Generate
                                        </button>
                                    </form>

                                    {generatedHabits.length > 0 && (
                                        <div className="space-y-2 pt-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Suggested Daily Micro-Habits:</span>
                                                <button
                                                    onClick={handleAddAllHabits}
                                                    className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                                >
                                                    <Plus className="w-3 h-3" />
                                                    Add All to Tracker
                                                </button>
                                            </div>

                                            <div className="space-y-1.5">
                                                {generatedHabits.map((h, i) => (
                                                    <div key={i} className="p-2.5 bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between text-xs">
                                                        <span className="font-bold text-slate-800 dark:text-slate-200">{h.name}</span>
                                                        <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-violet-500/10 text-violet-600 dark:text-violet-400">{h.category}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {addSuccessMsg && (
                                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs rounded-xl flex items-center gap-2">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                            <span>{addSuccessMsg}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB 3: AI Coach Advice */}
                            {activeTab === 'coach' && (
                                <div className="space-y-4">
                                    <div className="p-4 bg-gradient-to-tr from-violet-600/10 via-indigo-600/10 to-emerald-500/10 border border-violet-500/20 rounded-2xl space-y-3">
                                        <div className="flex items-center gap-2">
                                            <Sparkles className="w-4 h-4 text-amber-500" />
                                            <h4 className="font-extrabold text-xs text-slate-800 dark:text-white">Personal Behavioral Insight</h4>
                                        </div>

                                        {coachLoading ? (
                                            <div className="flex items-center gap-2 text-xs text-slate-500 py-4">
                                                <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
                                                <span>Analyzing completion patterns...</span>
                                            </div>
                                        ) : (
                                            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed whitespace-pre-line">
                                                {coachAdvice || 'Complete your habits daily to get customized AI insights!'}
                                            </p>
                                        )}

                                        <button
                                            onClick={fetchCoachAdvice}
                                            disabled={coachLoading}
                                            className="w-full py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors cursor-pointer"
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

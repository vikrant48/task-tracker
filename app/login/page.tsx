'use client';

import React, { useState, useTransition } from 'react';
import { login, signup } from './actions';

export default function LoginPage() {
    const [mode, setMode] = useState<'login' | 'signup'>('login');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        const form = e.currentTarget;
        const formData = new FormData(form);

        startTransition(async () => {
            if (mode === 'login') {
                const result = await login(null, formData);
                if (result?.error) {
                    setError(result.error);
                }
            } else {
                const result = await signup(null, formData);
                if (result?.error) {
                    setError(result.error);
                } else if (result?.success) {
                    setSuccess(result.success);
                    form.reset();
                }
            }
        });
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
            {/* Dynamic Background Gradients */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-violet-600/10 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[120px]" />

            <div className="sm:mx-auto sm:w-full sm:max-w-md z-10">
                <h1 className="text-center text-4xl font-extrabold text-white tracking-tight sm:text-5xl">
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-indigo-400">
                        FocusFlow
                    </span>
                </h1>
                <p className="mt-2 text-center text-sm text-slate-400">
                    Your sleek daily routine and habit companion
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4 md:px-0">
                <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 py-8 px-6 shadow-2xl rounded-2xl sm:px-10">
                    {/* Tab switching */}
                    <div className="flex border-b border-slate-800 mb-6">
                        <button
                            onClick={() => {
                                setMode('login');
                                setError(null);
                                setSuccess(null);
                            }}
                            className={`pb-3 text-sm font-semibold flex-1 transition-all ${mode === 'login'
                                ? 'text-violet-400 border-b-2 border-violet-400'
                                : 'text-slate-400 hover:text-slate-200'
                                }`}
                        >
                            Sign In
                        </button>
                        <button
                            onClick={() => {
                                setMode('signup');
                                setError(null);
                                setSuccess(null);
                            }}
                            className={`pb-3 text-sm font-semibold flex-1 transition-all ${mode === 'signup'
                                ? 'text-violet-400 border-b-2 border-violet-400'
                                : 'text-slate-400 hover:text-slate-200'
                                }`}
                        >
                            Sign Up
                        </button>
                    </div>

                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-slate-300">
                                Email address
                            </label>
                            <div className="mt-1">
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    className="appearance-none block w-full px-3 py-2 border border-slate-800 rounded-lg bg-slate-950 placeholder-slate-500 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all sm:text-sm"
                                    placeholder="you@example.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-slate-300">
                                Password
                            </label>
                            <div className="mt-1">
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    className="appearance-none block w-full px-3 py-2 border border-slate-800 rounded-lg bg-slate-950 placeholder-slate-500 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all sm:text-sm"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="rounded-lg bg-red-950/40 border border-red-900/50 p-3">
                                <p className="text-sm text-red-400 text-center">{error}</p>
                            </div>
                        )}

                        {success && (
                            <div className="rounded-lg bg-emerald-950/40 border border-emerald-900/50 p-3">
                                <p className="text-sm text-emerald-400 text-center">{success}</p>
                            </div>
                        )}

                        <div>
                            <button
                                type="submit"
                                disabled={isPending}
                                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-md text-sm font-medium text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isPending ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Create Account'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

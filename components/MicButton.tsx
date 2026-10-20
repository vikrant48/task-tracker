'use client';

import { Mic, MicOff } from 'lucide-react';

// Microphone toggle shown inside a text input; pulses red while listening
export default function MicButton({ listening, onClick }: { listening: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={listening ? 'Stop voice input' : 'Speak instead of typing'}
            aria-pressed={listening}
            title={listening ? 'Listening… tap to stop' : 'Voice input'}
            className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${listening
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
                }`}
        >
            {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>
    );
}

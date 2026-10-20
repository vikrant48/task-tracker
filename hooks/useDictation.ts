'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Minimal Web Speech API types (not part of TypeScript's DOM lib)
interface SpeechRecognitionLike {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onstart: (() => void) | null;
    onend: (() => void) | null;
    onerror: (() => void) | null;
    onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
    start(): void;
    stop(): void;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognition(): SpeechRecognitionConstructor | undefined {
    const w = window as Window & {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

// Add spoken words after whatever is already typed
export const appendSpoken = (current: string, spoken: string) => (current.trim() ? `${current.trim()} ${spoken}` : spoken);

// Voice input for one or more text fields. `listeningFor` says which field's microphone is on;
// only one microphone session runs at a time.
export function useDictation<Target extends string>() {
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const [listeningFor, setListeningFor] = useState<Target | null>(null);

    // Stop listening if the component unmounts mid-dictation
    useEffect(() => () => recognitionRef.current?.stop(), []);

    const stop = useCallback(() => recognitionRef.current?.stop(), []);

    const toggle = (target: Target, onText: (text: string) => void) => {
        if (listeningFor === target) {
            stop();
            return;
        }

        const SpeechRecognition = getSpeechRecognition();
        if (!SpeechRecognition) {
            alert('Voice input is not supported on this browser. Please type instead.');
            return;
        }

        stop();
        try {
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'en-US';

            recognition.onstart = () => setListeningFor(target);
            recognition.onend = () => {
                // Ignore the end of a session that a newer one has already replaced
                if (recognitionRef.current !== recognition) return;
                recognitionRef.current = null;
                setListeningFor(null);
            };
            recognition.onerror = () => recognition.stop();
            recognition.onresult = (event) => {
                const transcript = event.results[0]?.[0]?.transcript?.trim();
                if (transcript) onText(transcript);
            };

            recognitionRef.current = recognition;
            recognition.start();
        } catch (e) {
            console.error('Speech recognition error:', e);
            recognitionRef.current = null;
            setListeningFor(null);
        }
    };

    return { listeningFor, toggle, stop };
}

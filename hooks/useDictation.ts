'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Minimal Web Speech API types (not part of TypeScript's DOM lib)
interface SpeechRecognitionLike {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onstart: (() => void) | null;
    onend: (() => void) | null;
    onerror: ((event: { error: string }) => void) | null;
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

// The installed iPhone app (Home Screen) has no speech service, even though Safari does
const isIosStandalone = () =>
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

// A readable reason for a SpeechRecognition error code
export function dictationErrorMessage(code: string): string {
    switch (code) {
        case 'not-allowed':
        case 'service-not-allowed':
            return isIosStandalone()
                ? "Voice input isn't available in the installed iPhone app. Use the mic on your keyboard, or open the site in Safari."
                : 'Microphone access is blocked. Allow the microphone for this site in your browser settings, then try again.';
        case 'audio-capture':
            return 'No microphone was found.';
        case 'network':
            return 'Voice input needs an internet connection.';
        case 'no-speech':
            return "Didn't catch that. Tap the mic and speak again.";
        case 'aborted':
            return '';
        default:
            return 'Voice input stopped unexpectedly. Please try again or type instead.';
    }
}

// Add spoken words after whatever is already typed
export const appendSpoken = (current: string, spoken: string) => (current.trim() ? `${current.trim()} ${spoken}` : spoken);

// Voice input for one or more text fields. `listeningFor` says which field's microphone is on;
// only one microphone session runs at a time.
export function useDictation<Target extends string>() {
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const [listeningFor, setListeningFor] = useState<Target | null>(null);
    // Why the last attempt failed (shown next to the field), or null
    const [error, setError] = useState<string | null>(null);

    // Stop listening if the component unmounts mid-dictation
    useEffect(() => () => recognitionRef.current?.stop(), []);

    const stop = useCallback(() => recognitionRef.current?.stop(), []);

    const toggle = (target: Target, onText: (text: string) => void) => {
        setError(null);
        if (listeningFor === target) {
            stop();
            return;
        }

        const SpeechRecognition = getSpeechRecognition();
        if (!SpeechRecognition) {
            setError(
                isIosStandalone()
                    ? "Voice input isn't available in the installed iPhone app. Use the mic on your keyboard instead."
                    : "This browser doesn't support voice input (try Chrome, Edge or Safari). Please type instead."
            );
            return;
        }

        stop();
        try {
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = navigator.language || 'en-US';

            recognition.onstart = () => setListeningFor(target);
            recognition.onend = () => {
                // Ignore the end of a session that a newer one has already replaced
                if (recognitionRef.current !== recognition) return;
                recognitionRef.current = null;
                setListeningFor(null);
            };
            recognition.onerror = (event) => {
                const message = dictationErrorMessage(event.error);
                if (message) setError(message);
                recognition.stop();
            };
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
            setError('Could not start voice input. Please try again or type instead.');
        }
    };

    return { listeningFor, error, toggle, stop };
}

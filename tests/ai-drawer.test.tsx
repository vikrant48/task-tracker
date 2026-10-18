// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import AICoachDrawer from '@/components/AICoachDrawer';

// Fake Web Speech API: each instance is recorded so the test can "speak" into it
type FakeRecognition = {
    onstart: (() => void) | null;
    onend: (() => void) | null;
    onresult: ((e: { results: { transcript: string }[][] }) => void) | null;
    start: () => void;
    stop: ReturnType<typeof vi.fn>;
};
let sessions: FakeRecognition[] = [];

beforeEach(() => {
    sessions = [];
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = class {
        onstart: (() => void) | null = null;
        onend: (() => void) | null = null;
        onresult: FakeRecognition['onresult'] = null;
        stop = vi.fn(() => this.onend?.());
        constructor() {
            sessions.push(this as unknown as FakeRecognition);
        }
        start() {
            this.onstart?.();
        }
    };
});

afterEach(cleanup);

const speak = (session: FakeRecognition, transcript: string) =>
    act(() => {
        session.onresult?.({ results: [[{ transcript }]] });
        session.onend?.();
    });

function openGoalsTab() {
    render(<AICoachDrawer tasks={[]} buildCoachStats={() => []} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open FocusFlow AI assistant' }));
    fireEvent.click(screen.getByRole('button', { name: /Goals/ }));
    return screen.getByRole('textbox', { name: 'Your goal' }) as HTMLInputElement;
}

describe('AI drawer voice input', () => {
    it('appends speech to the goal input after any typed text', () => {
        const input = openGoalsTab();
        fireEvent.change(input, { target: { value: 'Get fit and' } });

        fireEvent.click(screen.getByRole('button', { name: 'Speak instead of typing' }));
        expect(screen.getByRole('button', { name: 'Stop voice input' }).getAttribute('aria-pressed')).toBe('true');

        speak(sessions[0], 'run a half marathon');

        expect(input.value).toBe('Get fit and run a half marathon');
        expect(screen.getByRole('button', { name: 'Speak instead of typing' }).getAttribute('aria-pressed')).toBe('false');
    });

    it('tapping the mic again stops listening', () => {
        openGoalsTab();
        fireEvent.click(screen.getByRole('button', { name: 'Speak instead of typing' }));
        fireEvent.click(screen.getByRole('button', { name: 'Stop voice input' }));
        expect(sessions[0].stop).toHaveBeenCalled();
    });

    it('stops listening when switching tabs, so speech never lands in the wrong box', () => {
        openGoalsTab();
        fireEvent.click(screen.getByRole('button', { name: 'Speak instead of typing' }));
        fireEvent.click(screen.getByRole('button', { name: /Quick Log/ }));

        expect(sessions[0].stop).toHaveBeenCalled();
        expect((screen.getByRole('textbox', { name: 'What did you complete today?' }) as HTMLInputElement).value).toBe('');
    });

    it('the Quick Log input has its own microphone', () => {
        openGoalsTab();
        fireEvent.click(screen.getByRole('button', { name: /Quick Log/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Speak instead of typing' }));
        speak(sessions[0], 'drank water');
        expect((screen.getByRole('textbox', { name: 'What did you complete today?' }) as HTMLInputElement).value).toBe('drank water');
    });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { isStrongPassword } from '@/lib/password';

const actions = vi.hoisted(() => ({ login: vi.fn(), signup: vi.fn() }));
vi.mock('@/app/login/actions', () => actions);

import LoginPage from '@/app/login/page';

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe('password rules', () => {
    it('needs 6+ characters, a capital letter and a special character', () => {
        expect(isStrongPassword('Abc!12')).toBe(true);
        expect(isStrongPassword('abc!12')).toBe(false); // no capital
        expect(isStrongPassword('Abc123')).toBe(false); // no special
        expect(isStrongPassword('Ab!1')).toBe(false); // too short
    });
});

describe('login page', () => {
    it('shows and hides the password', () => {
        render(<LoginPage />);
        const input = screen.getByLabelText('Password') as HTMLInputElement;
        expect(input.type).toBe('password');
        fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
        expect(input.type).toBe('text');
        fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
        expect(input.type).toBe('password');
    });

    it('on signup, flags a weak password with an info icon and does not submit it', () => {
        render(<LoginPage />);
        fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));
        fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'a@b.co' } });
        fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'abcdef' } });

        expect(screen.getByRole('button', { name: 'Password requirements' })).toBeTruthy();
        expect(screen.getByText('One capital letter (A–Z)')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
        expect(actions.signup).not.toHaveBeenCalled();

        fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Abcdef!' } });
        expect(screen.queryByRole('button', { name: 'Password requirements' })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
        expect(actions.signup).toHaveBeenCalledTimes(1);
    });

    it('does not apply the new rules when signing in', () => {
        render(<LoginPage />);
        fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'old' } });
        expect(screen.queryByRole('button', { name: 'Password requirements' })).toBeNull();
    });
});

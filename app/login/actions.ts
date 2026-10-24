'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isStrongPassword } from '@/lib/password';

export type AuthResult = { error?: string; success?: string } | undefined;

// FormData values can be File objects; only accept non-empty strings
function readCredentials(formData: FormData) {
    const email = formData.get('email');
    const password = formData.get('password');
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) return null;
    return { email: email.trim(), password };
}

export async function login(formData: FormData): Promise<AuthResult> {
    const credentials = readCredentials(formData);
    if (!credentials) {
        return { error: 'Email and password are required.' };
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(credentials);

    if (error) {
        return { error: error.message };
    }

    revalidatePath('/', 'layout');
    redirect('/');
}

export async function signup(formData: FormData): Promise<AuthResult> {
    const credentials = readCredentials(formData);
    if (!credentials) {
        return { error: 'Email and password are required.' };
    }

    if (!isStrongPassword(credentials.password)) {
        return { error: 'Password needs at least 6 characters, one capital letter and one special character.' };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp(credentials);

    if (error) {
        return { error: error.message };
    }
    // Supabase hides whether an email is registered: an existing account comes back with no identities
    if (data.user && data.user.identities?.length === 0) {
        return { error: 'An account with this email already exists. Please sign in.' };
    }
    // No session means Supabase requires email confirmation first
    if (!data.session) {
        return { success: 'Account created! Check your inbox and confirm your email, then sign in.' };
    }

    // Signed in straight away
    revalidatePath('/', 'layout');
    redirect('/');
}

export async function signout() {
    const supabase = await createClient();
    await supabase.auth.signOut();
    revalidatePath('/', 'layout');
    redirect('/login');
}

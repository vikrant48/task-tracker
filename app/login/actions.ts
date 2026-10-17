'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

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

    const supabase = await createClient();
    const { error } = await supabase.auth.signUp(credentials);

    if (error) {
        return { error: error.message };
    }

    return { success: 'Account created! You can now log in.' };
}

export async function signout() {
    const supabase = await createClient();
    await supabase.auth.signOut();
    revalidatePath('/', 'layout');
    redirect('/login');
}

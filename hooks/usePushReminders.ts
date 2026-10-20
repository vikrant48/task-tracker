'use client';

import { useCallback, useEffect, useState } from 'react';
import type { BrowserSupabaseClient } from '@/lib/supabase/client';
import { localClock, timeToMinutes } from '@/lib/reminders';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

export interface ReminderState {
    enabled: boolean;
    time: string; // 'HH:MM', local
}

// Push needs a service worker and the Push API. On iPhone that means the app is installed to the Home Screen.
export const pushSupported = () =>
    typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && VAPID_PUBLIC_KEY !== '';

function base64UrlToBytes(base64Url: string): Uint8Array<ArrayBuffer> {
    const base64 = (base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const bytes = new Uint8Array(new ArrayBuffer(raw.length));
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
}

// The daily scheduled reminder: one time per user, in their timezone, sent by /api/reminders/cron
export function usePushReminders(supabase: BrowserSupabaseClient, userId: string) {
    const [state, setState] = useState<ReminderState>({ enabled: false, time: '20:00' });
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        let cancelled = false;
        supabase
            .from('reminder_settings')
            .select('enabled, remind_at')
            .eq('user_id', userId)
            .then(({ data }) => {
                if (cancelled) return;
                const row = data?.[0];
                if (row) setState({ enabled: row.enabled, time: row.remind_at.slice(0, 5) });
                setLoaded(true);
            });
        return () => {
            cancelled = true;
        };
    }, [supabase, userId]);

    // Subscribe this device and save the time. Throws an Error with a readable message.
    const enable = useCallback(async (time: string) => {
        if (!pushSupported()) throw new Error('Scheduled reminders are not supported in this browser.');
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') throw new Error('Notifications are blocked. Allow them in your browser or phone settings, then try again.');

        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) throw new Error('Open the installed app (or the live site) to turn on reminders.');
        const subscription =
            (await registration.pushManager.getSubscription()) ??
            (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY) }));

        const res = await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subscription.toJSON()),
        });
        if (!res.ok) throw new Error('Could not register this device for reminders.');

        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        const clock = localClock(new Date(), timezone);
        const { error } = await supabase.from('reminder_settings').upsert({
            user_id: userId,
            enabled: true,
            remind_at: time,
            timezone,
            updated_at: new Date().toISOString(),
            // A time that has already passed today starts tomorrow
            ...(clock.minutes >= timeToMinutes(time) ? { last_sent_on: clock.date } : {}),
        });
        if (error) throw new Error('Could not save your reminder time.');
        setState({ enabled: true, time });
    }, [supabase, userId]);

    const disable = useCallback(async () => {
        const { error } = await supabase
            .from('reminder_settings')
            .upsert({ user_id: userId, enabled: false, remind_at: state.time, updated_at: new Date().toISOString() });
        if (error) throw new Error('Could not turn off reminders.');
        setState((s) => ({ ...s, enabled: false }));
    }, [supabase, userId, state.time]);

    return { ...state, loaded, enable, disable };
}

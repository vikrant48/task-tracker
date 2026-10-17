'use client';

import { useCallback, useReducer, useSyncExternalStore } from 'react';

export type ReminderPermission = NotificationPermission | 'unsupported';

// Notification permission has no change event; re-read it on render (forced after a request)
const noopSubscribe = () => () => {};
const readPermission = (): ReminderPermission => ('Notification' in window ? Notification.permission : 'unsupported');

function showNotification(title: string, body: string) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const fallback = () => new Notification(title, { body, icon: '/icon-192x192.png' });

    if (!('serviceWorker' in navigator)) {
        fallback();
        return;
    }

    // getRegistration() resolves undefined when no worker is registered (e.g. dev),
    // whereas serviceWorker.ready would wait forever
    navigator.serviceWorker.getRegistration()
        .then((reg) => {
            if (reg) return reg.showNotification(title, { body, icon: '/icon-192x192.png', badge: '/icon-192x192.png' });
            fallback();
        })
        .catch(fallback);
}

// Browser notifications for daily progress. (Only sent on demand; scheduled reminders need Web Push.)
export function useReminders() {
    const [, rerender] = useReducer((n: number) => n + 1, 0);
    const permission = useSyncExternalStore(noopSubscribe, readPermission, () => 'default' as ReminderPermission);

    const sendProgressReminder = useCallback((totalHabits: number, completedToday: number) => {
        const remaining = totalHabits - completedToday;
        if (totalHabits === 0) {
            showNotification('FocusFlow Daily Tracker', 'Add your daily habits and track your streak milestones!');
        } else if (remaining > 0) {
            showNotification(
                'FocusFlow Daily Reminder ⏰',
                `You have ${remaining} habit${remaining > 1 ? 's' : ''} left to complete today. Keep your streak going!`
            );
        } else {
            showNotification('All Habits Completed!', "Awesome job! You've completed all your habits for today.");
        }
    }, []);

    const enableReminders = useCallback(async (totalHabits: number, completedToday: number) => {
        if (!('Notification' in window)) {
            alert('Notifications are not supported on this browser.');
            return;
        }

        if (Notification.permission === 'denied') {
            alert('Notifications are blocked by your browser settings. To enable reminders:\n\n1. Click the lock/settings icon at the left of your address bar.\n2. Turn Notifications ON / Allow.\n3. Refresh the page.');
            return;
        }

        try {
            const result = await Notification.requestPermission();
            rerender();
            if (result === 'granted') {
                showNotification('Daily Reminders Activated! 🎉', "We'll notify you to check off your habits!");
                sendProgressReminder(totalHabits, completedToday);
            } else if (result === 'denied') {
                alert('Notification permission was blocked. Please enable notifications in your browser site settings.');
            }
        } catch (e) {
            console.error('Error requesting notification permission:', e);
        }
    }, [sendProgressReminder]);

    return { permission, enableReminders, sendProgressReminder };
}

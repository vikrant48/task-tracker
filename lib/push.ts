import webpush from 'web-push';

// Web Push sender (server only). Keys come from `npx web-push generate-vapid-keys`.
let configured = false;

export function pushConfigured(): boolean {
    if (configured) return true;
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    if (!publicKey || !privateKey) return false;
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', publicKey, privateKey);
    configured = true;
    return true;
}

export interface StoredSubscription {
    endpoint: string;
    p256dh: string;
    auth: string;
}

// 'gone' means the browser dropped the subscription and it should be deleted
export async function sendPush(sub: StoredSubscription, payload: { title: string; body: string; url?: string }): Promise<'sent' | 'gone' | 'failed'> {
    try {
        await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify(payload),
            { TTL: 60 * 60 * 4, urgency: 'normal' }
        );
        return 'sent';
    } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) return 'gone';
        console.error('Push failed:', status ?? err);
        return 'failed';
    }
}

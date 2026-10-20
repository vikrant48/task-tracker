import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Saves this browser's push subscription for the signed-in user. Writes go through the service role
// (clients can't insert subscriptions directly), so an endpoint always belongs to whoever registered it last.
const subscriptionSchema = z.object({
    endpoint: z.url().max(1000).refine((u) => u.startsWith('https://'), 'Push endpoints use HTTPS'),
    keys: z.object({
        p256dh: z.string().min(1).max(200),
        auth: z.string().min(1).max(100),
    }),
});

export async function POST(req: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = subscriptionSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid subscription.' }, { status: 400 });
    const { endpoint, keys } = parsed.data;

    try {
        const { error } = await createAdminClient()
            .from('push_subscriptions')
            .upsert({ endpoint, user_id: user.id, p256dh: keys.p256dh, auth: keys.auth }, { onConflict: 'endpoint' });
        if (error) throw error;
    } catch (err) {
        console.error('Error saving push subscription:', err);
        return NextResponse.json({ error: 'Could not save the subscription.' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
}

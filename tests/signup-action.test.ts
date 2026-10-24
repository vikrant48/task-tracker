import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({ signUp: vi.fn(), redirect: vi.fn((path: string) => { throw new Error(`REDIRECT ${path}`); }) }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { signUp: h.signUp } }) }));
vi.mock('next/navigation', () => ({ redirect: h.redirect }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { signup } from '@/app/login/actions';

const form = (password: string) => {
    const f = new FormData();
    f.set('email', 'new@example.com');
    f.set('password', password);
    return f;
};

beforeEach(() => vi.clearAllMocks());

describe('signup action', () => {
    it('signs the user in straight away when Supabase returns a session', async () => {
        h.signUp.mockResolvedValue({ data: { user: { identities: [{}] }, session: { access_token: 'x' } }, error: null });
        await expect(signup(form('Secret!1'))).rejects.toThrow('REDIRECT /');
    });

    it('asks to confirm the email when there is no session yet', async () => {
        h.signUp.mockResolvedValue({ data: { user: { identities: [{}] }, session: null }, error: null });
        expect(await signup(form('Secret!1'))).toEqual({ success: expect.stringContaining('confirm your email') });
    });

    it('reports an existing account and rejects weak passwords on the server', async () => {
        h.signUp.mockResolvedValue({ data: { user: { identities: [] }, session: null }, error: null });
        expect(await signup(form('Secret!1'))).toEqual({ error: expect.stringContaining('already exists') });
        expect(await signup(form('weak'))).toEqual({ error: expect.stringContaining('capital letter') });
        expect(h.signUp).toHaveBeenCalledTimes(1);
    });
});

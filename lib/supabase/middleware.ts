import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/lib/database.types';

const PUBLIC_ROUTES = ['/login', '/signup'];

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                    supabaseResponse = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
                },
            },
        }
    );

    // Refreshes the session if expired. If the refresh token is dead (signed out elsewhere, expired,
    // database restored), Supabase clears the session cookies through setAll above.
    const {
        data: { user },
    } = await supabase.auth.getUser();

    // Any response other than supabaseResponse must carry its cookies: they hold the rotated
    // refresh token (dropping it logs the user out on the next request) or the deletion of a dead
    // session (dropping it makes every request retry the failed refresh).
    const withSessionCookies = <T extends NextResponse>(response: T) => {
        supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
        return response;
    };
    const redirectTo = (pathname: string) => {
        const url = request.nextUrl.clone();
        url.pathname = pathname;
        return withSessionCookies(NextResponse.redirect(url));
    };

    const path = request.nextUrl.pathname;
    // Protected by default: anything not explicitly public requires a session
    const isPublicRoute = PUBLIC_ROUTES.some((route) => path === route || path.startsWith(`${route}/`));

    if (!user && path.startsWith('/api/')) {
        return withSessionCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
    }
    if (!user && !isPublicRoute) return redirectTo('/login');
    if (user && isPublicRoute) return redirectTo('/');

    return supabaseResponse;
}

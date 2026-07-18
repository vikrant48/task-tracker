import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
    return await updateSession(request);
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - File extensions (e.g. svg, png, manifest.json, etc.)
         */
        '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json|js|css|woff2|woff|ttf|ico|webmanifest)$).*)',
    ],
};

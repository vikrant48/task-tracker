'use client';

import { useCallback, useSyncExternalStore } from 'react';

// Whether a CSS media query matches. False on the server and where matchMedia is missing (e.g. jsdom).
export function useMediaQuery(query: string): boolean {
    const subscribe = useCallback(
        (onChange: () => void) => {
            if (typeof window.matchMedia !== 'function') return () => {};
            const list = window.matchMedia(query);
            list.addEventListener('change', onChange);
            return () => list.removeEventListener('change', onChange);
        },
        [query]
    );
    return useSyncExternalStore(
        subscribe,
        () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
        () => false
    );
}

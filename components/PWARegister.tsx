'use client';

import { useEffect } from 'react';

export default function PWARegister() {
    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;

        // In development, a cache-first worker serves stale bundles and breaks HMR: remove it instead
        if (process.env.NODE_ENV !== 'production') {
            navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((reg) => reg.unregister()));
            return;
        }

        const register = () => {
            navigator.serviceWorker
                // updateViaCache 'none': the browser always checks the network for a new sw.js
                .register('/sw.js', { updateViaCache: 'none' })
                .catch((err) => {
                    console.error('[PWA] Service Worker registration failed', err);
                });
        };

        // The effect can run after `load` has already fired, in which case the listener would never trigger
        if (document.readyState === 'complete') {
            register();
            return;
        }

        window.addEventListener('load', register, { once: true });
        return () => window.removeEventListener('load', register);
    }, []);

    return null;
}

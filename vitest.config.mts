import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
    // Next.js uses the automatic JSX runtime; tell esbuild to do the same
    esbuild: { jsx: 'automatic' },
    resolve: {
        alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
    },
    test: {
        include: ['tests/**/*.test.{ts,tsx}'],
        environment: 'node',
        restoreMocks: true,
    },
});

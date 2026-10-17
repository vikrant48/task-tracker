'use client';

// Runs `html` as a script during HTML parsing (before first paint). On the client the element is
// rendered as inert text/plain so React doesn't warn about rendering <script> tags; the type
// mismatch is expected (suppressHydrationWarning). See Next.js "Preventing flash before hydration".
export default function InlineScript({ html }: { html: string }) {
    return (
        <script
            type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'}
            suppressHydrationWarning
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}

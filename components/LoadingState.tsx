import { Loader2 } from 'lucide-react';

export default function LoadingState({ label = 'Loading...' }: { label?: string }) {
    return (
        <div role="status" aria-live="polite" className="flex-1 flex flex-col items-center justify-center p-12 gap-3 min-h-[300px]">
            <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
            <span className="text-sm text-slate-500 dark:text-slate-400 font-semibold">{label}</span>
        </div>
    );
}

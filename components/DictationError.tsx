// Why voice input failed, shown under the field that has the microphone
export default function DictationError({ message }: { message: string | null }) {
    if (!message) return null;
    return (
        <p role="alert" className="mt-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
            {message}
        </p>
    );
}

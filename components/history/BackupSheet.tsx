'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { format } from 'date-fns';
import { DatabaseBackup, Download, Upload, Loader2, CheckCircle2 } from 'lucide-react';
import type { BrowserSupabaseClient } from '@/lib/supabase/client';
import { exportBackup, parseBackup, restoreBackup, type RestoreSummary } from '@/lib/backup';
import { downloadFile } from '@/lib/csv';
import Sheet from '@/components/Sheet';

interface BackupSheetProps {
    supabase: BrowserSupabaseClient;
    userId: string;
    // Called after a restore so the page can reload its data
    onRestored: () => void;
    onClose: () => void;
}

const MAX_FILE_BYTES = 20 * 1024 * 1024;

// Download all your data as JSON, or restore it from such a file (merges; nothing is deleted)
export default function BackupSheet({ supabase, userId, onRestored, onClose }: BackupSheetProps) {
    const fileInput = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState<'export' | 'import' | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [restored, setRestored] = useState<RestoreSummary | null>(null);

    const handleExport = async () => {
        setBusy('export');
        setError(null);
        try {
            const backup = await exportBackup(supabase, userId);
            downloadFile(`focusflow_backup_${format(new Date(), 'yyyy_MM_dd')}.json`, JSON.stringify(backup, null, 2), 'application/json');
        } catch (err) {
            console.error('Error exporting backup:', err);
            setError('Could not create the backup. Please try again.');
        } finally {
            setBusy(null);
        }
    };

    const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // lets the same file be picked again
        if (!file) return;
        setError(null);
        setRestored(null);
        if (file.size > MAX_FILE_BYTES) {
            setError('That file is too large to be a FocusFlow backup.');
            return;
        }

        setBusy('import');
        try {
            const backup = parseBackup(await file.text());
            setRestored(await restoreBackup(supabase, userId, backup));
            onRestored();
        } catch (err) {
            console.error('Error restoring backup:', err);
            setError(err instanceof Error && err.message.includes('FocusFlow backup') ? err.message : 'Could not restore the backup. Please try again.');
        } finally {
            setBusy(null);
        }
    };

    const actionClass =
        'w-full h-13 px-3 flex items-center gap-4 rounded-xl text-base font-semibold text-slate-700 dark:text-slate-200 transition-colors disabled:opacity-40 active:bg-slate-100 dark:active:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer';

    return (
        <Sheet titleId="backup-title" onClose={onClose}>
            <h3 id="backup-title" className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <DatabaseBackup className="w-5 h-5 text-violet-500" />
                Backup &amp; restore
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Your habits, check-ins, notes and daily tasks in one file. Restoring adds or updates items and never deletes anything.
            </p>

            <div className="flex flex-col mt-4">
                <button type="button" onClick={handleExport} disabled={busy !== null} className={actionClass}>
                    {busy === 'export' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                    Download backup
                </button>
                <button type="button" onClick={() => fileInput.current?.click()} disabled={busy !== null} className={actionClass}>
                    {busy === 'import' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                    Restore from file
                </button>
                <input ref={fileInput} type="file" accept="application/json,.json" onChange={handleFile} className="hidden" aria-label="Backup file" />
            </div>

            {error && (
                <p role="alert" className="mt-3 text-sm font-semibold text-rose-600 dark:text-rose-400">
                    {error}
                </p>
            )}
            {restored && (
                <p role="status" className="mt-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    Restored {restored.habits} habits, {restored.checkIns} check-ins and {restored.dailyTasks} daily tasks.
                </p>
            )}

            <div className="flex justify-end mt-5">
                <button type="button" onClick={onClose} className="h-12 sm:h-10 px-4 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 cursor-pointer">
                    Done
                </button>
            </div>
        </Sheet>
    );
}

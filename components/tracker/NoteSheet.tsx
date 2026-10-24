'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { StickyNote, Loader2 } from 'lucide-react';
import Sheet from '@/components/Sheet';
import MicButton from '@/components/MicButton';
import DictationError from '@/components/DictationError';
import { appendSpoken, useDictation } from '@/hooks/useDictation';

const MAX_NOTE = 500;

interface NoteSheetProps {
    taskName: string;
    dateStr: string;
    initialNote: string;
    // Resolves to whether the note was saved
    onSave: (note: string) => Promise<boolean>;
    onClose: () => void;
}

// A short note for one habit on one day ("ran 5k", "skipped: sick"). Typed or dictated.
export default function NoteSheet({ taskName, dateStr, initialNote, onSave, onClose }: NoteSheetProps) {
    const [note, setNote] = useState(initialNote);
    const [saving, setSaving] = useState(false);
    const dictation = useDictation<'note'>();

    const save = async () => {
        dictation.stop();
        setSaving(true);
        const ok = await onSave(note);
        setSaving(false);
        if (ok) onClose();
    };

    return (
        <Sheet titleId="note-title" onClose={onClose}>
            <h3 id="note-title" className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <StickyNote className="w-5 h-5 text-amber-500" />
                Note
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 truncate">
                {taskName} · {format(parseISO(dateStr), 'EEE, MMM d')}
            </p>

            <div className="mt-4 relative">
                <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE))}
                    aria-label="Note"
                    placeholder="How did it go?"
                    rows={4}
                    maxLength={MAX_NOTE}
                    autoFocus
                    className="w-full resize-none bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 pr-12 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <div className="absolute right-2 top-2">
                    <MicButton
                        listening={dictation.listeningFor === 'note'}
                        onClick={() => dictation.toggle('note', (text) => setNote((prev) => appendSpoken(prev, text).slice(0, MAX_NOTE)))}
                    />
                </div>
                <DictationError message={dictation.error} />
                <span className="block text-right text-xs text-slate-400 mt-1">{note.length}/{MAX_NOTE}</span>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 mt-4">
                <button type="button" onClick={onClose} className="h-12 sm:h-10 px-4 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 cursor-pointer">
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={save}
                    disabled={saving || note.trim() === initialNote.trim()}
                    className="h-12 sm:h-10 px-5 rounded-xl text-sm font-bold text-white bg-linear-to-r from-violet-600 to-indigo-600 disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
                >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {initialNote && !note.trim() ? 'Remove note' : 'Save note'}
                </button>
            </div>
        </Sheet>
    );
}

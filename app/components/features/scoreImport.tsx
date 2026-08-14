// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { readScoreFile } from "../../../core/musicxmlFile";
import { gradeOf } from "../../../core/scoreDifficulty";
import {
    hasPitchedNotes,
    importTempo,
    seedTitle,
    TEMPO_MAX,
    TEMPO_MIN,
} from "../../../core/scoreImport";
import { readScoreMeta } from "../../../core/scoreMeta";
import { songId } from "../../../core/songId";
import { useSongSource, useStore, useXmlCodec } from "../../contexts/services";
import { loadCatalog, type Score, saveUserScore } from "../../lib/catalog";
import { m } from "../../paraglide/messages.js";
import { Button, buttonClasses } from "../ui/button";
import { fieldClasses } from "../ui/classes";
import { UploadIcon } from "../ui/icons";
import { LocalizedLink as Link } from "../ui/localizedLink";
import { GradeChip } from "./scoreGrade";
import { StaffPreview } from "./staffPreview";

// What a dropped file becomes once read and parsed: the MusicXML plus the editable
// fields, seeded from the score's own metadata, that the player confirms or amends.
type Draft = {
    xml: string;
    title: string;
    composer: string;
    tempo: string;
    // What the score itself is marked at, kept beside the editable field so emptying the
    // box falls back to the figure it started with.
    marked: number;
    description: string;
    beatsPerBar: number;
    grade: number;
};

const FIELD = `w-full ${fieldClasses}`;

// Add your own score: drag-and-drop (or pick) a MusicXML file, preview it on a
// staff with its editable metadata, and confirm it into the local library.
// Self-contained over the injected services, so the import page and the
// library's Manage tab render the identical flow.
export function ScoreImport() {
    const store = useStore();
    const xmlCodec = useXmlCodec();
    const songs = useSongSource();
    const [draft, setDraft] = useState<Draft | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const [savedId, setSavedId] = useState<string | null>(null);
    const [duplicate, setDuplicate] = useState(false);

    const handleFile = async (file: File | undefined) => {
        setError(null);
        setSavedId(null);
        setDuplicate(false);
        if (!file) {
            return;
        }
        const xml = await readScoreFile(file);
        if (xml === null) {
            setError(m.import_read_error());
            return;
        }
        if (!hasPitchedNotes(xmlCodec, xml)) {
            setError(m.import_no_notes());
            return;
        }
        // The fingerprint identifies the piece by its notes: if it is already bundled, in
        // the song catalogue, or previously imported, flag it as a duplicate.
        const id = songId(xml);
        const known = new Set(loadCatalog(store).map((entry) => entry.id));
        setDuplicate(
            known.has(id) || ((await songs.manifest()) ?? []).some((song) => song.id === id),
        );
        const meta = readScoreMeta(xmlCodec, xml);
        setDraft({
            xml,
            title: seedTitle(meta.title),
            composer: meta.composer,
            tempo: String(meta.tempo),
            marked: meta.tempo,
            description: "",
            beatsPerBar: meta.beatsPerBar,
            // Grade by the content fingerprint, the same id the score is saved under and the
            // key gradeOf memoises on. A title slug collides — every untitled import shares
            // one — so the preview would show the first import's grade for the rest.
            grade: gradeOf(xmlCodec, id, xml),
        });
    };

    const onDrop = (event: React.DragEvent) => {
        event.preventDefault();
        setDragOver(false);
        handleFile(event.dataTransfer.files?.[0]);
    };

    const confirmAdd = () => {
        if (!draft) {
            return;
        }
        const title = draft.title.trim() || m.import_untitled();
        const score: Score = {
            // The id is the content fingerprint, so re-importing the same file (or one the
            // catalogue already has) resolves to the same piece rather than a duplicate.
            id: songId(draft.xml),
            title,
            composer: draft.composer.trim(),
            description: draft.description.trim(),
            xml: draft.xml,
            tempo: importTempo(draft.tempo, draft.marked),
            beatsPerBar: draft.beatsPerBar,
            bundled: false,
        };
        if (!saveUserScore(store, score)) {
            setError(m.import_save_failed());
            return;
        }
        setDraft(null);
        setSavedId(score.id);
    };

    const reset = () => {
        setDraft(null);
        setError(null);
        setSavedId(null);
    };

    const set = (patch: Partial<Draft>) =>
        setDraft((current) => current && { ...current, ...patch });

    return (
        <div className="space-y-6">
            {savedId && (
                <div
                    role="status"
                    className="space-y-2 rounded-md border border-success-line bg-success-surface p-4 text-sm dark:bg-success-surface/40"
                >
                    <p className="font-medium text-success">{m.import_added()}</p>
                    <div className="flex flex-wrap gap-3">
                        <Link to={`/play/${savedId}`} className={buttonClasses("primary")}>
                            {m.import_play_now()}
                        </Link>
                        <Button variant="secondary" onClick={reset}>
                            {m.import_add_another()}
                        </Button>
                    </div>
                </div>
            )}

            {!draft && !savedId && (
                // The whole dashed area is the file control: the input is visually
                // hidden but still focusable, so a click or keyboard activation opens
                // the picker while a drag drops straight onto it.
                <label
                    onDrop={onDrop}
                    onDragOver={(event) => {
                        event.preventDefault();
                        setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-12 text-center transition-colors ${
                        dragOver
                            ? "border-accent-ring bg-accent-surface dark:bg-accent-surface/40"
                            : "border-line-strong"
                    }`}
                >
                    <input
                        type="file"
                        accept=".musicxml,.xml,.mxl,application/xml"
                        className="sr-only"
                        onChange={(event) => {
                            handleFile(event.target.files?.[0]);
                            event.target.value = "";
                        }}
                    />
                    <UploadIcon className="h-8 w-8 text-muted" />
                    <span className="font-medium text-body">{m.import_drop_here()}</span>
                    <span className="text-xs text-muted">{m.import_formats()}</span>
                </label>
            )}

            {error && <p className="text-sm text-danger">{error}</p>}
            {duplicate && <p className="text-sm text-warn">{m.import_duplicate()}</p>}

            {draft && (
                <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="rounded-md border border-line p-2">
                            <StaffPreview
                                xml={draft.xml}
                                label={draft.title || m.import_untitled()}
                            />
                        </div>
                        <div className="space-y-3">
                            <label className="block space-y-1">
                                <span className="text-xs font-medium text-muted">
                                    {m.import_field_title()}
                                </span>
                                <input
                                    className={FIELD}
                                    value={draft.title}
                                    onChange={(event) => set({ title: event.target.value })}
                                />
                            </label>
                            <label className="block space-y-1">
                                <span className="text-xs font-medium text-muted">
                                    {m.import_field_composer()}
                                </span>
                                <input
                                    className={FIELD}
                                    value={draft.composer}
                                    onChange={(event) => set({ composer: event.target.value })}
                                />
                            </label>
                            <div className="flex items-end gap-3">
                                <label className="block flex-1 space-y-1">
                                    <span className="text-xs font-medium text-muted">
                                        {m.import_field_tempo()}
                                    </span>
                                    <input
                                        type="number"
                                        min={TEMPO_MIN}
                                        max={TEMPO_MAX}
                                        className={FIELD}
                                        value={draft.tempo}
                                        onChange={(event) => set({ tempo: event.target.value })}
                                    />
                                </label>
                                <span className="flex items-center gap-1 pb-1.5 text-xs text-muted">
                                    {m.import_field_grade()}
                                    <GradeChip grade={draft.grade} />
                                </span>
                            </div>
                            <label className="block space-y-1">
                                <span className="text-xs font-medium text-muted">
                                    {m.import_field_description()}
                                </span>
                                <input
                                    className={FIELD}
                                    value={draft.description}
                                    onChange={(event) => set({ description: event.target.value })}
                                />
                            </label>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Button variant="primary" onClick={confirmAdd}>
                            {m.import_confirm()}
                        </Button>
                        <Button variant="secondary" onClick={reset}>
                            {m.import_choose_different()}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

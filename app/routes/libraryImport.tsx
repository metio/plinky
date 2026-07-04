// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useState } from "react";
import { Button, buttonClasses } from "../components/button";
import { UploadIcon } from "../components/icons";
import { LocalizedLink as Link } from "../components/localizedLink";
import { GradeChip } from "../components/scoreGrade";
import { StaffPreview } from "../components/staffPreview";
import { loadCatalog, type Score, readScoreMeta, saveUserScore, slugify } from "../lib/catalog";
import { readScoreFile } from "../lib/musicxmlFile";
import { markDiscovered } from "../lib/onboarding";
import { gradeOf } from "../lib/scoreDifficulty";
import { songId } from "../lib/songId";
import { loadManifest } from "../lib/songs";
import { routeMeta } from "../lib/site";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/libraryImport";

export function meta(_args: Route.MetaArgs) {
    return routeMeta(m.import_heading(), m.meta_import_description());
}

// Accept anything that parses as MusicXML with at least one pitched note; OSMD
// renders whatever it can, so the bar for import is just "has notes".
function looksPlayable(xml: string): boolean {
    try {
        const doc = new DOMParser().parseFromString(xml, "application/xml");
        return !doc.querySelector("parsererror") && doc.querySelector("note > pitch") !== null;
    } catch {
        return false;
    }
}

// What a dropped file becomes once read and parsed: the MusicXML plus the editable
// fields, seeded from the score's own metadata, that the player confirms or amends.
type Draft = {
    xml: string;
    title: string;
    composer: string;
    tempo: string;
    description: string;
    beatsPerBar: number;
    grade: number;
};

const FIELD =
    "w-full rounded-md border border-gray-300 bg-transparent px-2 py-1.5 text-sm text-gray-800 dark:border-gray-700 dark:text-gray-200";

export default function LibraryImportRoute() {
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
        if (!looksPlayable(xml)) {
            setError(m.import_no_notes());
            return;
        }
        // The fingerprint identifies the piece by its notes: if it is already bundled, in
        // the song catalogue, or previously imported, flag it as a duplicate.
        const id = songId(xml);
        const known = new Set(loadCatalog().map((entry) => entry.id));
        setDuplicate(known.has(id) || (await loadManifest()).some((song) => song.id === id));
        const meta = readScoreMeta(xml);
        setDraft({
            xml,
            title: meta.title === "Untitled" ? "" : meta.title,
            composer: meta.composer,
            tempo: String(meta.tempo),
            description: "",
            beatsPerBar: meta.beatsPerBar,
            grade: gradeOf(slugify(meta.title), xml),
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
        const tempo = Number(draft.tempo);
        const score: Score = {
            // The id is the content fingerprint, so re-importing the same file (or one the
            // catalogue already has) resolves to the same piece rather than a duplicate.
            id: songId(draft.xml),
            title,
            composer: draft.composer.trim(),
            description: draft.description.trim(),
            xml: draft.xml,
            tempo: Number.isFinite(tempo) && tempo > 0 ? Math.round(tempo) : 90,
            beatsPerBar: draft.beatsPerBar,
            bundled: false,
        };
        if (!saveUserScore(score)) {
            setError(m.import_save_failed());
            return;
        }
        markDiscovered("imported");
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
        <main className="mx-auto max-w-2xl space-y-6 p-6 font-sans">
            <header className="space-y-2">
                <h1 className="text-2xl font-semibold">{m.import_heading()}</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">{m.import_intro()}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    {m.import_local_note()}{" "}
                    <Link to="/settings" className="text-indigo-700 underline dark:text-indigo-300">
                        {m.import_backup_link()}
                    </Link>
                    .
                </p>
            </header>

            {savedId && (
                <div
                    role="status"
                    className="space-y-2 rounded-md border border-green-300 bg-green-50 p-4 text-sm dark:border-green-900 dark:bg-green-950/40"
                >
                    <p className="font-medium text-green-800 dark:text-green-300">
                        {m.import_added()}
                    </p>
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
                            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40"
                            : "border-gray-300 dark:border-gray-700"
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
                    <UploadIcon className="h-8 w-8 text-gray-500 dark:text-gray-400" />
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                        {m.import_drop_here()}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        {m.import_formats()}
                    </span>
                </label>
            )}

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            {duplicate && (
                <p className="text-sm text-amber-700 dark:text-amber-400">{m.import_duplicate()}</p>
            )}

            {draft && (
                <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="rounded-md border border-gray-200 p-2 dark:border-gray-800">
                            <StaffPreview
                                xml={draft.xml}
                                label={draft.title || m.import_untitled()}
                            />
                        </div>
                        <div className="space-y-3">
                            <label className="block space-y-1">
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                    {m.import_field_title()}
                                </span>
                                <input
                                    className={FIELD}
                                    value={draft.title}
                                    onChange={(event) => set({ title: event.target.value })}
                                />
                            </label>
                            <label className="block space-y-1">
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
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
                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                        {m.import_field_tempo()}
                                    </span>
                                    <input
                                        type="number"
                                        min={20}
                                        max={400}
                                        className={FIELD}
                                        value={draft.tempo}
                                        onChange={(event) => set({ tempo: event.target.value })}
                                    />
                                </label>
                                <span className="flex items-center gap-1 pb-1.5 text-xs text-gray-500 dark:text-gray-400">
                                    {m.import_field_grade()}
                                    <GradeChip grade={draft.grade} />
                                </span>
                            </div>
                            <label className="block space-y-1">
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
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

            <Link
                to="/library"
                className="block text-sm text-indigo-700 underline dark:text-indigo-300"
            >
                {m.import_back_to_library()}
            </Link>
        </main>
    );
}

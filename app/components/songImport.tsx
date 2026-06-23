// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import abcjs from "abcjs";
import { useState } from "react";
import { musicXmlToAbc } from "../lib/musicxml";
import { buildExercise, parseTempo, saveUserSong } from "../lib/songs";
import { buildSteps } from "../lib/steps";

// Render the ABC off-screen and count the steps it yields: anything the trainers
// can play is accepted, so the generalized matcher decides what is importable.
function playableSteps(abc: string): number {
    const element = document.createElement("div");
    element.style.position = "absolute";
    element.style.visibility = "hidden";
    document.body.appendChild(element);
    try {
        const tune = abcjs.renderAbc(element, abc, { add_classes: true })[0];
        return tune ? buildSteps(tune, parseTempo(abc)).length : 0;
    } catch {
        return 0;
    } finally {
        element.remove();
    }
}

const PLACEHOLDER = "Paste ABC notation, e.g.\nX:1\nT:My Tune\nM:4/4\nL:1/4\nK:C\nC D E F |";

export function SongImport({
    existingIds,
    onAdded,
}: {
    existingIds: string[];
    onAdded: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [text, setText] = useState("");
    const [error, setError] = useState<string | null>(null);

    const add = () => {
        const abc = text.trim();
        if (!abc) {
            setError("Paste some ABC notation first.");
            return;
        }
        if (playableSteps(abc) === 0) {
            setError("No playable notes found — is this valid ABC?");
            return;
        }
        saveUserSong(buildExercise(abc, existingIds));
        setText("");
        setError(null);
        setOpen(false);
        onAdded();
    };

    const readFile = (file: File | undefined) => {
        if (!file) {
            return;
        }
        file.text().then((content) => {
            // MusicXML is converted to ABC up front; anything else is treated as
            // ABC and validated on Add.
            const isMusicXml =
                /\.(musicxml|xml)$/i.test(file.name) || content.includes("<score-partwise");
            if (!isMusicXml) {
                setText(content);
                setError(null);
                return;
            }
            try {
                setText(musicXmlToAbc(content));
                setError(null);
            } catch (cause) {
                setError(cause instanceof Error ? cause.message : "Could not read that file.");
            }
        });
    };

    if (!open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300"
            >
                Import a song
            </button>
        );
    }

    return (
        <div className="space-y-3 rounded-md border border-gray-200 dark:border-gray-800 p-4">
            <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={6}
                placeholder={PLACEHOLDER}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 p-2 font-mono text-sm"
            />
            <div className="flex flex-wrap items-center gap-3">
                <input
                    type="file"
                    accept=".abc,.musicxml,.xml,text/plain,application/xml"
                    onChange={(event) => readFile(event.target.files?.[0])}
                    className="text-sm"
                    title="Upload ABC or MusicXML"
                />
                <button
                    type="button"
                    onClick={add}
                    className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white"
                >
                    Add song
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setOpen(false);
                        setError(null);
                    }}
                    className="text-sm text-gray-500 dark:text-gray-400 underline"
                >
                    Cancel
                </button>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
    );
}

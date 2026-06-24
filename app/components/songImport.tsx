// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useState } from "react";
import { musicXmlToAbc } from "../lib/musicxml";
import { buildExercise, parseTempo, saveUserSong } from "../lib/songs";
import { buildSteps } from "../lib/steps";
import { m } from "../paraglide/messages.js";

// Render the ABC off-screen and count the steps it yields: anything the trainers
// can play is accepted, so the generalized matcher decides what is importable.
// abcjs is loaded on demand so it stays out of the home page's bundle.
async function playableSteps(abc: string): Promise<number> {
    const { default: abcjs } = await import("abcjs");
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

    const add = async () => {
        const abc = text.trim();
        if (!abc) {
            setError(m.import_paste_first());
            return;
        }
        if ((await playableSteps(abc)) === 0) {
            setError(m.import_no_notes());
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
                setError(cause instanceof Error ? cause.message : m.import_read_error());
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
                {m.import_song()}
            </button>
        );
    }

    return (
        <div className="space-y-3 rounded-md border border-gray-200 dark:border-gray-800 p-4">
            <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={6}
                placeholder={m.import_placeholder()}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 p-2 font-mono text-sm"
            />
            <div className="flex flex-wrap items-center gap-3">
                <input
                    type="file"
                    accept=".abc,.musicxml,.xml,text/plain,application/xml"
                    onChange={(event) => readFile(event.target.files?.[0])}
                    className="text-sm"
                    title={m.import_upload_title()}
                />
                <button
                    type="button"
                    onClick={add}
                    className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white"
                >
                    {m.import_add_song()}
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setOpen(false);
                        setError(null);
                    }}
                    className="text-sm text-gray-500 dark:text-gray-400 underline"
                >
                    {m.import_cancel()}
                </button>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
    );
}

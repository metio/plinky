// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useState } from "react";
import { buildScore, saveUserScore } from "../lib/catalog";
import { m } from "../paraglide/messages.js";

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

export function ScoreImport({
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
        const xml = text.trim();
        if (!xml) {
            setError(m.import_paste_first());
            return;
        }
        if (!looksPlayable(xml)) {
            setError(m.import_no_notes());
            return;
        }
        saveUserScore(buildScore(xml, existingIds));
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
            setText(content);
            setError(null);
        });
    };

    if (!open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300"
            >
                {m.import_score()}
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
                    accept=".musicxml,.xml,application/xml"
                    onChange={(event) => readFile(event.target.files?.[0])}
                    className="text-sm"
                    title={m.import_upload_title()}
                />
                <button
                    type="button"
                    onClick={add}
                    className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white"
                >
                    {m.import_add_score()}
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
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
    );
}

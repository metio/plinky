// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useRef, useState } from "react";
import { exportAllPack, importScoresPack, loadUserScores } from "../lib/catalog";
import { m } from "../paraglide/messages.js";

function pluralScores(count: number): string {
    return count === 1 ? m.backup_scores_one({ count }) : m.backup_scores_other({ count });
}

function pluralCurriculums(count: number): string {
    return count === 1
        ? m.backup_curriculums_one({ count })
        : m.backup_curriculums_other({ count });
}

// Back up and restore the local score library as a Plinky score pack: a "download
// all" export and a mass-import that accepts a pack (e.g. a music school's
// curriculum). Scores live only on this device, so this is how users keep them.
export function ScoreBackup() {
    const [count, setCount] = useState(0);
    const [status, setStatus] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setCount(loadUserScores().length);
    }, []);

    const download = () => {
        const blob = new Blob([exportAllPack()], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "plinky-scores.json";
        anchor.click();
        URL.revokeObjectURL(url);
    };

    const importFile = async (file: File | undefined) => {
        if (!file) {
            return;
        }
        try {
            const result = importScoresPack(await file.text());
            const parts = [m.backup_imported_scores({ count: pluralScores(result.imported) })];
            if (result.curriculums > 0) {
                parts.push(
                    m.backup_imported_curriculums({
                        count: pluralCurriculums(result.curriculums),
                    }),
                );
            }
            setStatus(`${parts.join(" ")}.`);
            setCount(loadUserScores().length);
        } catch (error) {
            setStatus(error instanceof Error ? error.message : m.backup_import_error());
        }
    };

    return (
        <section className="space-y-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {m.backup_heading()}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
                {m.backup_intro({ count: pluralScores(count) })}
            </p>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={download}
                    disabled={count === 0}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300"
                >
                    {m.backup_download()}
                </button>
                <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300"
                >
                    {m.backup_import()}
                </button>
                <input
                    ref={fileRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={(event) => {
                        importFile(event.target.files?.[0]);
                        // Clear the value so selecting the same file again re-fires change.
                        event.target.value = "";
                    }}
                />
            </div>
            {status && <p className="text-sm text-gray-700 dark:text-gray-300">{status}</p>}
        </section>
    );
}

// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useRef, useState } from "react";
import { exportAllPack, exportFullPack, importScoresPack, loadUserScores } from "../../lib/catalog";
import { downloadBlob } from "../../lib/download";
import { useStore, useXmlCodec } from "../../contexts/services";
import { m } from "../../paraglide/messages.js";
import { Button } from "../ui/button";
import { linkClasses, sectionHeadingClasses } from "../ui/classes";
import { LocalizedLink as Link } from "../ui/localizedLink";

function pluralScores(count: number): string {
    return count === 1 ? m.backup_scores_one({ count }) : m.backup_scores_other({ count });
}

// Back up and restore the local score library as a Plinky score bundle: a "download
// all" export and an import that accepts a bundle (a backup, or a set shared by a
// teacher). Scores live only on this device, so this is how users keep them.
export function ScoreBackup() {
    const store = useStore();
    const xmlCodec = useXmlCodec();
    const [count, setCount] = useState(0);
    const [status, setStatus] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    // Identifies the latest pack read so a slower earlier import can't report its
    // (stale) result over a newer pick that has already landed.
    const readSeq = useRef(0);

    useEffect(() => {
        setCount(loadUserScores(store).length);
    }, [store]);

    const download = () => {
        downloadBlob(exportAllPack(store), "application/json", "plinky-scores.json");
    };

    // The full local library, bundled pieces included — for taking Plinky's
    // built-in songs along, not just restoring your own.
    const downloadFull = () => {
        downloadBlob(exportFullPack(store), "application/json", "plinky-library.json");
    };

    const importFile = async (file: File | undefined) => {
        if (!file) {
            return;
        }
        const mine = ++readSeq.current;
        try {
            const result = importScoresPack(store, xmlCodec, await file.text());
            if (mine !== readSeq.current) {
                return;
            }
            setStatus(`${m.backup_imported_scores({ count: pluralScores(result.imported) })}.`);
            setCount(loadUserScores(store).length);
        } catch (error) {
            if (mine !== readSeq.current) {
                return;
            }
            setStatus(error instanceof Error ? error.message : m.backup_import_error());
        }
    };

    return (
        <section className="space-y-3">
            <h2 className={sectionHeadingClasses}>{m.backup_heading()}</h2>
            <p className="text-sm text-muted">{m.backup_intro({ count: pluralScores(count) })}</p>
            {/* Downloading a score pack reads as "my progress is safe" — it is sheet music
                and nothing else, and the file that carries the rest lives somewhere else
                entirely. Saying so here is cheaper than the day somebody finds out. */}
            <p className="text-sm text-muted">
                {m.backup_not_progress()}{" "}
                <Link to="/settings" className={linkClasses}>
                    {m.progress_backup_heading()}
                </Link>
            </p>
            <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={download} disabled={count === 0}>
                    {m.backup_download()}
                </Button>
                <Button variant="secondary" onClick={downloadFull}>
                    {m.backup_download_full()}
                </Button>
                <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                    {m.backup_import()}
                </Button>
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
            {status && <p className="text-sm text-body">{status}</p>}
        </section>
    );
}

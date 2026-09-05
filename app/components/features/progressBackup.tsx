// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useRef, useState } from "react";
import { useStore } from "../../contexts/services";
import { downloadBlob } from "../../lib/download";
import { countProgressEntries, exportProgress, importProgress } from "../../lib/progressBackup";
import { m } from "../../paraglide/messages.js";
import { Button } from "../ui/button";
import { ConfirmButton } from "../ui/confirmButton";
import { ArchiveIcon } from "../ui/icons";
import { SettingsSection } from "../ui/settingsSection";

// Back up and restore everything this device remembers — grades, review schedule,
// takes, fingerings, preferences and the score library — as one file.
//
// Progress lives in this browser and nowhere else, so without this a new phone
// starts from zero and evicted storage takes the lot. Restoring replaces rather
// than merges, which is destructive enough to sit behind the app-wide two-click
// confirm; a successful one reloads, because every store caches its own snapshot
// and a wholesale write underneath them notifies nobody.
export function ProgressBackup() {
    const store = useStore();
    const [count, setCount] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    // Identifies the latest file read so a slower earlier pick cannot report its
    // stale result over a newer one that has already landed.
    const readSeq = useRef(0);

    useEffect(() => {
        setCount(countProgressEntries(store));
    }, [store]);

    const download = () => {
        const savedAt = new Date().toISOString();
        downloadBlob(
            exportProgress(store, savedAt),
            "application/json",
            `plinky-progress-${savedAt.slice(0, 10)}.json`,
        );
    };

    const restore = async (file: File | undefined) => {
        if (!file) {
            return;
        }
        const mine = ++readSeq.current;
        // Read first, then check the pick is still the latest, then import: the guard
        // has to stand between the slow read and the write, or a slower earlier pick
        // still replaces the whole device store after a later one was chosen.
        const text = await file.text();
        if (mine !== readSeq.current) {
            return;
        }
        const result = importProgress(store, text);
        if (result.ok) {
            window.location.reload();
            return;
        }
        setError(
            result.problem === "storage"
                ? // Two different places to be left in, and only one of them is "nothing
                  // changed". Saying that when half a bundle had landed would send the
                  // player away believing their device was untouched.
                  result.undone
                    ? m.progress_backup_error_storage()
                    : m.progress_backup_error_partial()
                : result.problem === "empty"
                  ? m.progress_backup_error_empty()
                  : m.progress_backup_error_unreadable(),
        );
    };

    return (
        <SettingsSection
            title={m.progress_backup_heading()}
            hint={m.progress_backup_hint()}
            icon={<ArchiveIcon className="h-5 w-5" />}
        >
            <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" onClick={download} disabled={count === 0}>
                    {m.progress_backup_download()}
                </Button>
                <ConfirmButton
                    confirmLabel={m.progress_backup_restore_confirm()}
                    onConfirm={() => {
                        setError(null);
                        fileRef.current?.click();
                    }}
                >
                    {m.progress_backup_restore()}
                </ConfirmButton>
                <input
                    ref={fileRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={(event) => {
                        restore(event.target.files?.[0]);
                        // Clear the value so picking the same file again re-fires change.
                        event.target.value = "";
                    }}
                />
            </div>
            <p className="text-sm text-muted">
                {m.progress_backup_holds({ count: m.progress_backup_items({ count }) })}{" "}
                {m.progress_backup_restore_hint()}
            </p>
            {error && (
                <p role="alert" className="text-sm font-medium text-danger-strong">
                    {error}
                </p>
            )}
        </SettingsSection>
    );
}

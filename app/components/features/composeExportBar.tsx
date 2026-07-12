// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { m } from "../../paraglide/messages.js";
import { Button, buttonClasses } from "../ui/button";

type ComposeExportBarProps = {
    empty: boolean;
    noteCount: number;
    copied: boolean;
    onShare: () => void;
    onDownloadMidi: () => void;
    onDownloadMusicXml: () => void;
    onOpenFile: (file: File | undefined) => void;
    uploadError: string | null;
    // A parsed file is waiting because loading it would replace a non-empty take.
    pendingReplace: boolean;
    onConfirmReplace: () => void;
    onCancelReplace: () => void;
};

// How a take leaves and enters the page: the share link, the MIDI and MusicXML
// downloads, the file opener, and the replace confirmation an opened file waits
// on when a recording is already in progress.
export function ComposeExportBar({
    empty,
    noteCount,
    copied,
    onShare,
    onDownloadMidi,
    onDownloadMusicXml,
    onOpenFile,
    uploadError,
    pendingReplace,
    onConfirmReplace,
    onCancelReplace,
}: ComposeExportBarProps) {
    return (
        <section className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={onShare} disabled={empty}>
                {copied ? m.compose_copied() : m.compose_share()}
            </Button>
            <Button variant="secondary" onClick={onDownloadMidi} disabled={empty}>
                {m.compose_download_midi()}
            </Button>
            <Button variant="secondary" onClick={onDownloadMusicXml} disabled={empty}>
                {m.compose_download_musicxml()}
            </Button>
            <label className={buttonClasses("secondary", "cursor-pointer")}>
                {m.compose_open_file()}
                <input
                    type="file"
                    accept=".mid,.midi,.musicxml,.xml,.mxl,audio/midi"
                    className="sr-only"
                    onChange={(event) => {
                        onOpenFile(event.target.files?.[0]);
                        event.target.value = "";
                    }}
                />
            </label>
            <span className="text-sm text-gray-500 dark:text-gray-400">
                {m.compose_note_count({ count: noteCount })}
            </span>
            {uploadError && (
                <p className="w-full text-sm text-red-600 dark:text-red-400">{uploadError}</p>
            )}
            {pendingReplace && (
                <div className="flex w-full flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-red-700 dark:text-red-300">
                        {m.compose_replace_confirm()}
                    </span>
                    <Button variant="danger" onClick={onConfirmReplace}>
                        {m.compose_replace_yes()}
                    </Button>
                    <Button variant="ghost" onClick={onCancelReplace}>
                        {m.action_cancel()}
                    </Button>
                </div>
            )}
        </section>
    );
}

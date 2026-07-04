// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { toMidiNotes, toMusicXml } from "../../../core/composition";
import { buildMidiFile } from "../../../core/midiFile";
import { fileStem } from "../../lib/printScore";
import { ghostOnsets, type Take } from "../../lib/savedTakes";
import { m } from "../../paraglide/messages.js";
import { getLocale } from "../../paraglide/runtime.js";
import { Button, IconButton } from "../ui/button";
import { Disclosure } from "../ui/disclosure";
import { CloseIcon, PlayIcon, StopIcon } from "../ui/icons";
import { ShareGhostButton } from "./shareGhostButton";

// A short "3 minutes ago" for when a take was saved, localised without a message
// per unit by leaning on the platform's relative-time formatter.
export function formatAgo(fromMs: number, nowMs: number, locale: string): string {
    const seconds = Math.round((fromMs - nowMs) / 1000);
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    const abs = Math.abs(seconds);
    if (abs < 60) {
        return rtf.format(seconds, "second");
    }
    const minutes = Math.round(seconds / 60);
    if (Math.abs(minutes) < 60) {
        return rtf.format(minutes, "minute");
    }
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24) {
        return rtf.format(hours, "hour");
    }
    return rtf.format(Math.round(hours / 24), "day");
}

function download(filename: string, data: BlobPart, type: string): void {
    const url = URL.createObjectURL(new Blob([data], { type }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}

// Your saved performances of a piece: replay one onto the staff above, download it
// as MIDI or MusicXML, or delete it. Folded away by default so it never crowds the
// play surface; shown only when at least one take exists.
export function TakesList({
    id,
    takes,
    title,
    activeReplayId,
    playing,
    onReplay,
    onStop,
    onDelete,
}: {
    // The song id, so a take's ghost link points back at this piece.
    id: string;
    takes: Take[];
    title: string;
    // The take currently replaying, if any — its row shows a Stop control.
    activeReplayId: string | null;
    // True while anything (a replay or Listen) owns the synth and cursor, so the
    // other takes' replay buttons disable rather than fight over them.
    playing: boolean;
    onReplay: (take: Take) => void;
    onStop: () => void;
    onDelete: (takeId: string) => void;
}) {
    const now = Date.now();
    const stem = fileStem(title);
    return (
        <Disclosure summary={m.takes_heading({ count: takes.length })}>
            <ul className="space-y-2">
                {takes.map((take) => {
                    const replaying = activeReplayId === take.id;
                    return (
                        <li
                            key={take.id}
                            className="flex flex-wrap items-center gap-2 rounded-md border border-gray-200 p-2 text-sm dark:border-gray-800"
                        >
                            <span className="font-semibold">{take.letter || "—"}</span>
                            <span className="text-gray-500 dark:text-gray-400">
                                {formatAgo(take.createdAt, now, getLocale())}
                                {!take.complete && ` · ${m.takes_partial()}`}
                            </span>
                            {take.metrics && (
                                <span className="flex items-center gap-2 text-xs text-gray-500 tabular-nums dark:text-gray-400">
                                    <span>
                                        {m.scores_accuracy()} {take.metrics.accuracy}%
                                    </span>
                                    <span>
                                        {m.scores_timing()} {take.metrics.timing}%
                                    </span>
                                    <span>
                                        {m.scores_flow()} {take.metrics.flow}%
                                    </span>
                                </span>
                            )}
                            <span className="ml-auto flex items-center gap-1">
                                <IconButton
                                    label={replaying ? m.takes_stop() : m.takes_replay()}
                                    onClick={() => (replaying ? onStop() : onReplay(take))}
                                    disabled={playing && !replaying}
                                >
                                    {replaying ? <StopIcon /> : <PlayIcon />}
                                </IconButton>
                                <ShareGhostButton
                                    id={id}
                                    title={title}
                                    onsets={ghostOnsets(take)}
                                    label={m.takes_share_ghost()}
                                />
                                <Button
                                    onClick={() =>
                                        download(
                                            `${stem}-take.mid`,
                                            buildMidiFile(toMidiNotes(take.composition), {
                                                tempo: take.composition.tempo,
                                            }),
                                            "audio/midi",
                                        )
                                    }
                                >
                                    {m.takes_download_midi()}
                                </Button>
                                <Button
                                    onClick={() =>
                                        download(
                                            `${stem}-take.musicxml`,
                                            toMusicXml(take.composition),
                                            "application/xml",
                                        )
                                    }
                                >
                                    {m.takes_download_musicxml()}
                                </Button>
                                <IconButton
                                    label={m.takes_delete()}
                                    onClick={() => onDelete(take.id)}
                                >
                                    <CloseIcon />
                                </IconButton>
                            </span>
                        </li>
                    );
                })}
            </ul>
        </Disclosure>
    );
}

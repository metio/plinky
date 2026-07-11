// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { toMidiNotes, toMusicXml } from "../../../core/composition";
import { downloadBlob } from "../../lib/download";
import { buildMidiFile } from "../../../core/midiFile";
import { fileStem } from "../../lib/printScore";
import { ghostOnsets, type Take } from "../../../core/takes";
import { m } from "../../paraglide/messages.js";
import { getLocale } from "../../paraglide/runtime.js";
import { Button, IconButton } from "../ui/button";
import { CloseIcon, PlayIcon, StopIcon } from "../ui/icons";
import { ExportVideoButton } from "./exportVideoButton";
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

// The body of the Runs drawer: everything about your own performances of a piece in one
// place — a top action to share your last run as a ghost (available the moment you've
// played once, no save needed), and the list of saved runs to replay, race, download or
// delete. With nothing saved it explains how to get a run, so the drawer is never an empty
// mystery. The drawer frame supplies the heading and count, so this renders none of its own.
export function TakesPanel({
    id,
    takes,
    title,
    credit,
    activeReplayId,
    playing,
    lastRunOnsets,
    canShareLastRun,
    onReplay,
    onStop,
    onDelete,
}: {
    // The song id, so a take's ghost link points back at this piece.
    id: string;
    takes: Take[];
    title: string;
    // The provenance line an exported take video carries (title-only when the
    // piece has no composer/licence to credit).
    credit: string;
    // The take currently replaying, if any — its row shows a Stop control.
    activeReplayId: string | null;
    // True while anything (a replay or Listen) owns the synth and cursor, so the
    // other takes' replay buttons disable rather than fight over them.
    playing: boolean;
    // The onsets of your most recent run, sharable as a ghost even before you save a
    // take; null until you've played the piece through once this visit.
    lastRunOnsets: number[] | null;
    // Whether to offer that share — suppressed when the current ghost was loaded from a
    // friend's link rather than being your own run.
    canShareLastRun: boolean;
    onReplay: (take: Take) => void;
    onStop: () => void;
    onDelete: (takeId: string) => void;
}) {
    const now = Date.now();
    const stem = fileStem(title);
    return (
        <div className="space-y-3">
            {lastRunOnsets && canShareLastRun && (
                <div className="flex justify-start">
                    <ShareGhostButton
                        id={id}
                        title={title}
                        onsets={lastRunOnsets}
                        label={m.takes_share_last_run()}
                        showLabel
                    />
                </div>
            )}
            {takes.length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">{m.takes_empty_hint()}</p>
            ) : (
                <ul className="space-y-2">
                    {takes.map((take) => {
                        const replaying = activeReplayId === take.id;
                        return (
                            // A run is a small card of three fixed zones so no width can
                            // scramble it: a header line that never wraps (identity left,
                            // replay/delete pinned right), the metrics as their own quiet
                            // line, and a footer strip of ghost-styled export actions
                            // behind a hairline — wrapping inside the strip reads as a
                            // toolbar, not as overflow.
                            <li
                                key={take.id}
                                className="rounded-md border border-gray-200 text-sm dark:border-gray-800"
                            >
                                <div className="flex items-center gap-2 px-2 pt-1">
                                    <span className="font-semibold">{take.letter || "—"}</span>
                                    <span className="truncate text-gray-500 dark:text-gray-400">
                                        {formatAgo(take.createdAt, now, getLocale())}
                                        {!take.complete && ` · ${m.takes_partial()}`}
                                    </span>
                                    <span className="ml-auto flex shrink-0 items-center gap-1">
                                        <IconButton
                                            label={replaying ? m.takes_stop() : m.takes_replay()}
                                            onClick={() => (replaying ? onStop() : onReplay(take))}
                                            disabled={playing && !replaying}
                                        >
                                            {replaying ? <StopIcon /> : <PlayIcon />}
                                        </IconButton>
                                        <IconButton
                                            label={m.takes_delete()}
                                            onClick={() => onDelete(take.id)}
                                        >
                                            <CloseIcon />
                                        </IconButton>
                                    </span>
                                </div>
                                {take.metrics && (
                                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 px-2 pb-2 text-xs text-gray-500 tabular-nums dark:text-gray-400">
                                        <span>
                                            {m.scores_accuracy()} {take.metrics.accuracy}%
                                        </span>
                                        <span>
                                            {m.scores_timing()} {take.metrics.timing}%
                                        </span>
                                        <span>
                                            {m.scores_flow()} {take.metrics.flow}%
                                        </span>
                                    </div>
                                )}
                                <div className="flex flex-wrap items-center gap-x-1 border-t border-gray-200 px-1 py-1 dark:border-gray-800">
                                    <ShareGhostButton
                                        id={id}
                                        title={title}
                                        onsets={ghostOnsets(take)}
                                        label={m.takes_share_ghost()}
                                        variant="plain"
                                    />
                                    <Button
                                        variant="ghost"
                                        onClick={() =>
                                            downloadBlob(
                                                buildMidiFile(toMidiNotes(take.composition), {
                                                    tempo: take.composition.tempo,
                                                }),
                                                "audio/midi",
                                                `${stem}-take.mid`,
                                            )
                                        }
                                    >
                                        {m.takes_download_midi()}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        onClick={() =>
                                            downloadBlob(
                                                toMusicXml(take.composition),
                                                "application/xml",
                                                `${stem}-take.musicxml`,
                                            )
                                        }
                                    >
                                        {m.takes_download_musicxml()}
                                    </Button>
                                    <ExportVideoButton take={take} title={title} credit={credit} />
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

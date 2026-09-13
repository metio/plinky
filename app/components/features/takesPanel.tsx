// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { toMidiNotes, toMusicXml } from "../../../core/composition";
import { downloadMidi, downloadMusicXml } from "../../lib/download";
import { buildMidiFile } from "../../../core/midiFile";
import { takeFileStem } from "../../lib/takeFile";
import { scoreReadings } from "../../../core/grade";
import { ghostOnsets, type Take } from "../../../core/takes";
import { readingLabel } from "../../lib/scoreReadingLabels";
import { formatAgo } from "../../lib/relativeTime";
import { m } from "../../paraglide/messages.js";
import { getLocale } from "../../paraglide/runtime.js";
import { Button, IconButton } from "../ui/button";
import { Folio, FolioFigure, FolioRow } from "../ui/folio";
import { PlayIcon, StopIcon, TrashIcon } from "../ui/icons";
import { ExportAudioButton } from "./exportAudioButton";
import { ExportVideoButton } from "./exportVideoButton";
import type { OriginalScore } from "../../lib/scoreSnapshot";
import { ShareGhostButton } from "./shareGhostButton";

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
    license,
    activeReplayId,
    playing,
    original = null,
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
    license?: string;
    // The take currently replaying, if any — its row shows a Stop control.
    activeReplayId: string | null;
    // True while anything (a replay or Listen) owns the synth and cursor, so the
    // other takes' replay buttons disable rather than fight over them.
    playing: boolean;
    // The piece's notation + practised hand, for the exported video's score.
    original?: OriginalScore | null;
    onReplay: (take: Take) => void;
    onStop: () => void;
    onDelete: (takeId: string) => void;
}) {
    const now = Date.now();
    return (
        <div className="space-y-3">
            {takes.length === 0 ? (
                <p className="text-sm text-muted">{m.takes_empty_hint()}</p>
            ) : (
                <Folio>
                    {takes.map((take) => {
                        const replaying = activeReplayId === take.id;
                        return (
                            // A take is a Folio row: its letter in the margin, when it was
                            // played as its name with replay and delete at the end of the
                            // line, the readings as the line under it, and the exports
                            // beneath — wrapping inside that strip reads as a toolbar, not
                            // as overflow. The readings are the same list the panel at the
                            // end of a run shows, so a take shows every reading it stored.
                            <FolioRow
                                key={take.id}
                                size="compact"
                                margin={<FolioFigure value={take.letter || "—"} tone="ink" />}
                                name={`${formatAgo(take.createdAt, now, getLocale())}${
                                    take.complete ? "" : ` · ${m.takes_partial()}`
                                }`}
                                line={
                                    take.metrics ? (
                                        <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted tabular-nums">
                                            {scoreReadings(take.metrics).map(({ id, value }) => (
                                                <span key={id}>
                                                    {readingLabel[id]()} {value}%
                                                </span>
                                            ))}
                                        </span>
                                    ) : undefined
                                }
                                trailing={
                                    <span className="flex items-center gap-1">
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
                                            className="text-danger"
                                        >
                                            <TrashIcon />
                                        </IconButton>
                                    </span>
                                }
                            >
                                <div className="flex flex-wrap items-center gap-x-1">
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
                                            downloadMidi(
                                                buildMidiFile(toMidiNotes(take.composition), {
                                                    tempo: take.composition.tempo,
                                                    beatsPerBar: take.composition.beatsPerBar,
                                                }),
                                                takeFileStem(title, take),
                                            )
                                        }
                                    >
                                        {m.takes_download_midi()}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        onClick={() =>
                                            // The piece's title goes in the document too, so a
                                            // notation program heads the take with the name the
                                            // file already carries.
                                            downloadMusicXml(
                                                toMusicXml(take.composition, { title }),
                                                takeFileStem(title, take),
                                            )
                                        }
                                    >
                                        {m.takes_download_musicxml()}
                                    </Button>
                                    <ExportAudioButton take={take} title={title} />
                                    <ExportVideoButton
                                        take={take}
                                        title={title}
                                        credit={credit}
                                        license={license}
                                        original={original}
                                    />
                                </div>
                            </FolioRow>
                        );
                    })}
                </Folio>
            )}
        </div>
    );
}

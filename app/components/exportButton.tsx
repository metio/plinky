// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { toMidiNotes } from "../../core/composition";
import { buildMidiFile } from "../../core/midiFile";
import { parseMusicXml } from "../../core/musicxmlParse";
import { fileStem } from "../lib/printScore";
import { transposeMusicXml } from "../../core/transpose";
import { m } from "../paraglide/messages.js";
import { IconButton } from "./button";
import { NotesIcon } from "./icons";
import { useTranspose } from "./transposeContext";

// Exports the piece as a Standard MIDI File, derived straight from its MusicXML at
// the page's current transposition — no ScoreViewer or rendered cursor needed, so
// any page can place it. A score that can't be parsed just doesn't export.
export function ExportButton({ xml, title }: { xml: string; title: string }) {
    const transpose = useTranspose()?.transpose ?? 0;
    const exportMidi = () => {
        const source = transpose === 0 ? xml : transposeMusicXml(xml, transpose);
        const composition = parseMusicXml(source);
        if (!composition) {
            return;
        }
        const blob = new Blob(
            [buildMidiFile(toMidiNotes(composition), { tempo: composition.tempo })],
            { type: "audio/midi" },
        );
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${fileStem(title)}.mid`;
        anchor.click();
        URL.revokeObjectURL(url);
    };
    return (
        <IconButton
            variant="ghost"
            onClick={exportMidi}
            label={m.action_export_midi()}
            className="text-violet-600 dark:text-violet-400"
        >
            <NotesIcon />
        </IconButton>
    );
}

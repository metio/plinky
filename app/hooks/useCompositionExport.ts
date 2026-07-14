// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useCallback } from "react";
import {
    type Composition,
    encodeComposition,
    toMidiNotes,
    toMusicXml,
} from "../../core/composition";
import { buildMidiFile } from "../../core/midiFile";
import { downloadBlob } from "../lib/download";
import { fileStem } from "../lib/printScore";
import { localizeHref } from "../paraglide/runtime.js";
import { useCopied } from "./useCopied";

// The three ways a take leaves the page: a share link on the clipboard (with the
// transient "copied" flash), a Standard MIDI File, and MusicXML.
export function useCompositionExport(composition: Composition, title: string) {
    const [copied, flashCopied] = useCopied();

    const share = useCallback(() => {
        const code = encodeComposition(composition);
        const url = `${window.location.origin}${localizeHref("/compose")}?c=${code}`;
        navigator.clipboard
            ?.writeText(url)
            .then(() => flashCopied())
            .catch(() => {});
    }, [composition, flashCopied]);

    const downloadMidi = useCallback(() => {
        const data = buildMidiFile(toMidiNotes(composition), {
            tempo: composition.tempo,
            beatsPerBar: composition.beatsPerBar,
        });
        downloadBlob(data, "audio/midi", `${fileStem(title)}.mid`);
    }, [composition, title]);

    const downloadMusicXml = useCallback(() => {
        const xml = toMusicXml(composition, { title });
        downloadBlob(xml, "application/vnd.recordare.musicxml+xml", `${fileStem(title)}.musicxml`);
    }, [composition, title]);

    return { copied: copied !== null, share, downloadMidi, downloadMusicXml };
}

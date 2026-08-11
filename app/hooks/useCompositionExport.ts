// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useCallback } from "react";
import {
    type Composition,
    encodeComposition,
    toMidiNotes,
    toMusicXml,
} from "../../core/composition";
import { buildMidiFile } from "../../core/midiFile";
import { useAnalytics } from "../contexts/services";
import { downloadBlob } from "../lib/download";
import { fileStem } from "../lib/printScore";
import { useCopied } from "./useCopied";
import { localizedHref } from "../components/ui/href";

// The three ways a take leaves the page: a share link on the clipboard (with the
// transient "copied" flash), a Standard MIDI File, and MusicXML. Each reports a
// compose_export naming the format and the take's shape — instrumented here, at the
// one hook all three buttons drive, so the export bar stays presentational.
export function useCompositionExport(composition: Composition, title: string) {
    const [copied, flashCopied] = useCopied();
    const analytics = useAnalytics();

    const share = useCallback(() => {
        const code = encodeComposition(composition);
        const url = `${window.location.origin}${localizedHref("/compose")}?c=${code}`;
        navigator.clipboard
            ?.writeText(url)
            // Only a landed clipboard write counts as a share.
            .then(() => {
                analytics.track("compose_export", {
                    format: "link",
                    notes: composition.notes.length,
                    tempo: composition.tempo,
                    beats_per_bar: composition.beatsPerBar,
                });
                flashCopied();
            })
            .catch(() => {});
    }, [composition, flashCopied, analytics]);

    const downloadMidi = useCallback(() => {
        const data = buildMidiFile(toMidiNotes(composition), {
            tempo: composition.tempo,
            beatsPerBar: composition.beatsPerBar,
        });
        downloadBlob(data, "audio/midi", `${fileStem(title)}.mid`);
        analytics.track("compose_export", {
            format: "midi",
            notes: composition.notes.length,
            tempo: composition.tempo,
            beats_per_bar: composition.beatsPerBar,
        });
    }, [composition, title, analytics]);

    const downloadMusicXml = useCallback(() => {
        const xml = toMusicXml(composition, { title });
        downloadBlob(xml, "application/vnd.recordare.musicxml+xml", `${fileStem(title)}.musicxml`);
        analytics.track("compose_export", {
            format: "musicxml",
            notes: composition.notes.length,
            tempo: composition.tempo,
            beats_per_bar: composition.beatsPerBar,
        });
    }, [composition, title, analytics]);

    return { copied: copied !== null, share, downloadMidi, downloadMusicXml };
}

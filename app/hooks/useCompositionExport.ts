// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useCallback } from "react";
import {
    encodeComposition,
    midiFileFor,
    toMusicXml,
    type Composition,
} from "../../core/composition";
import { downloadMidi as saveMidi, downloadMusicXml as saveMusicXml } from "../lib/download";
import { fileStem } from "../lib/printScore";
import { useCopied } from "./useCopied";
import { localizedHref } from "../components/ui/href";

// The three ways a take leaves the page: a share link on the clipboard (with the
// transient "copied" flash), a Standard MIDI File, and MusicXML. Each reports a
// compose_export naming the format and the take's shape — instrumented here, at the
// one hook all three buttons drive, so the export bar stays presentational.
export function useCompositionExport(composition: Composition, title: string) {
    const [copied, flashCopied] = useCopied();

    const share = useCallback(() => {
        const code = encodeComposition(composition);
        const url = `${window.location.origin}${localizedHref("/compose")}?c=${code}`;
        navigator.clipboard
            ?.writeText(url)
            // Only a landed clipboard write counts as a share.
            .then(() => {
                flashCopied();
            })
            .catch(() => {});
    }, [composition, flashCopied]);

    const downloadMidi = useCallback(() => {
        saveMidi(midiFileFor(composition), fileStem(title));
    }, [composition, title]);

    const downloadMusicXml = useCallback(() => {
        saveMusicXml(toMusicXml(composition, { title }), fileStem(title));
    }, [composition, title]);

    return { copied: copied !== null, share, downloadMidi, downloadMusicXml };
}

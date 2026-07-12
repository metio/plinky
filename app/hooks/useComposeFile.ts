// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useCallback, useRef, useState } from "react";
import type { Composition } from "../../core/composition";
import { readScoreFile } from "../../core/musicxmlFile";
import { parseMusicXml } from "../../core/musicxmlParse";
import { useXmlCodec } from "../contexts/services";
import { m } from "../paraglide/messages.js";

type ComposeFileOptions = {
    // Whether loading would destroy work in progress — if so, the parsed file is
    // held for confirmation instead of applied.
    hasWork: () => boolean;
    onLoad: (loaded: Composition) => void;
};

// Load a MIDI or MusicXML file dropped or chosen by the player, replacing the
// take so they can carry work between devices. A non-empty take is never
// replaced silently: the parsed file waits in `pendingReplace` until the player
// confirms or cancels.
export function useComposeFile({ hasWork, onLoad }: ComposeFileOptions) {
    const xmlCodec = useXmlCodec();
    const [error, setError] = useState<string | null>(null);
    const [pendingReplace, setPendingReplace] = useState<Composition | null>(null);

    const optionsRef = useRef({ hasWork, onLoad });
    optionsRef.current = { hasWork, onLoad };

    const openFile = useCallback(
        async (file: File | undefined) => {
            setError(null);
            if (!file) {
                return;
            }
            let loaded: Composition | null = null;
            try {
                const bytes = new Uint8Array(await file.arrayBuffer());
                const isMidi =
                    bytes[0] === 0x4d &&
                    bytes[1] === 0x54 &&
                    bytes[2] === 0x68 &&
                    bytes[3] === 0x64;
                if (isMidi) {
                    // Only this handler needs the MIDI parser, and nothing else imports it,
                    // so it splits into its own chunk — worth loading on demand. The MusicXML
                    // codecs, by contrast, are already in the eager graph (the song/exercise
                    // sources and the export button import them), so importing them here is
                    // static: a dynamic import couldn't split anything off.
                    const { parseMidiFile } = await import("../../core/midiParse");
                    loaded = parseMidiFile(bytes);
                } else {
                    const xml = await readScoreFile(file);
                    loaded = xml ? parseMusicXml(xmlCodec, xml) : null;
                }
            } catch {
                // Reading the bytes or the on-demand MIDI parser throwing must surface the
                // same error as an unreadable file, not reject unhandled through `void`.
                loaded = null;
            }
            if (!loaded) {
                setError(m.compose_open_error());
                return;
            }
            if (optionsRef.current.hasWork()) {
                setPendingReplace(loaded);
                return;
            }
            optionsRef.current.onLoad(loaded);
        },
        [xmlCodec],
    );

    // Read through a ref — loading from inside a state updater would double-apply
    // under StrictMode.
    const pendingRef = useRef(pendingReplace);
    pendingRef.current = pendingReplace;
    const confirmReplace = useCallback(() => {
        if (pendingRef.current) {
            optionsRef.current.onLoad(pendingRef.current);
        }
        setPendingReplace(null);
    }, []);

    const cancelReplace = useCallback(() => setPendingReplace(null), []);

    return {
        openFile,
        error,
        pendingReplace: pendingReplace !== null,
        confirmReplace,
        cancelReplace,
    };
}

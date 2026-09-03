// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import type { Take } from "../../../core/takes";
import { useAudioExporter } from "../../contexts/services";
import { downloadBlob } from "../../lib/download";
import { takeFileStem } from "../../lib/takeFile";
import { m } from "../../paraglide/messages.js";
import { Button } from "../ui/button";

// Saves a take as a sound file — the recording of the playing, with no picture around it.
//
// One tap and no options, which is what sets it beside MIDI and MusicXML rather than inside
// the video panel. A video is composed: a format, a size, a frame rate, which layers show.
// A sound file has nothing to choose. The format is whatever this engine can produce best,
// which is a fact about the browser and not a decision to hand a player.
//
// Unlike the video button it is always offered. Where an encoder exists the file is
// compressed; where none does, the samples are written as they are — so there is no engine
// on which the answer is "you cannot have this".
export function ExportAudioButton({ take, title }: { take: Take; title: string }) {
    const exporter = useAudioExporter();
    const [working, setWorking] = useState(false);
    const [failed, setFailed] = useState(false);

    const save = async () => {
        setWorking(true);
        setFailed(false);
        try {
            const { blob, extension } = await exporter.export(take.composition.notes);
            downloadBlob(blob, blob.type, `${takeFileStem(title, take)}.${extension}`);
        } catch {
            // A rejection inside an async click handler reaches no error boundary, so
            // without this the button simply returns to idle and the player is told
            // nothing at all.
            setFailed(true);
        } finally {
            setWorking(false);
        }
    };

    return (
        <>
            <Button variant="ghost" onClick={save} disabled={working}>
                {working ? m.takes_audio_working() : m.takes_download_audio()}
            </Button>
            {failed && (
                <p role="status" className="w-full text-sm text-danger">
                    {m.feature_broken()}
                </p>
            )}
        </>
    );
}

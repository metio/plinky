// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
    type ExtraKind,
    extrasFor,
    playbackRateFor,
    regionFor,
    type SampleRegion,
} from "../../core/sampledPiano";
import type { SampleLookup, SampleSource, SampleVoice } from "../ports/sampleSource";

// Turns "this key, this hard" into "this recording, played this fast" — the pure mapping in
// core over whatever the source has decoded so far.
//
// It answers within the key press that asked, or answers nothing. A recording still in
// flight is not a note that waits: the engine plays its own voice, and the instrument
// improves under the player's hands rather than making them stop for it. The same contract
// covers the extras — a piano missing its key-off knock still sounds like a piano, and one
// that stalls waiting for it does not.
export function sampleLookup(source: SampleSource): SampleLookup {
    // The pack, but only when the player has asked for it. Both lookups gate on this: a
    // disabled instrument answers nothing at all.
    const pack = () => {
        const manifest = source.manifest();
        return manifest && source.state().enabled ? manifest : null;
    };

    // A region becomes a voice, or nothing. Shared by the struck notes and the extras
    // because the step from "this recording" to "this buffer, at this speed" is the same
    // one — only the list being searched differs.
    const voiceOf = (region: SampleRegion | null, pitch: number): SampleVoice | null => {
        if (!region) {
            return null;
        }
        const buffer = source.bufferFor(region);
        return buffer ? { buffer, rate: playbackRateFor(pitch, region.keyCentre) } : null;
    };

    return {
        voiceFor(pitch, velocity) {
            const manifest = pack();
            return manifest ? voiceOf(regionFor(manifest.notes, pitch, velocity), pitch) : null;
        },
        extraFor(pitch, velocity, kind: ExtraKind) {
            const manifest = pack();
            return manifest
                ? voiceOf(extrasFor(manifest.releases, pitch, velocity, kind), pitch)
                : null;
        },
    };
}

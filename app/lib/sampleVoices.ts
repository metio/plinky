// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { playbackRateFor, regionFor } from "../../core/sampledPiano";
import type { SampleSource } from "../ports/sampleSource";
import type { SampleLookup, SampleVoice } from "../adapters/webAudioEngine";

// Turns "this key, this hard" into "this recording, played this fast" — the pure mapping in
// core over whatever the source has decoded so far.
//
// It answers within the key press that asked, or answers nothing. A recording still in
// flight is not a note that waits: the engine plays its own voice, and the instrument
// improves under the player's hands rather than making them stop for it.
export function sampleLookup(source: SampleSource): SampleLookup {
    return {
        voiceFor(pitch: number, velocity: number): SampleVoice | null {
            const manifest = source.manifest();
            if (!manifest || !source.state().enabled) {
                return null;
            }
            const region = regionFor(manifest.notes, pitch, velocity);
            if (!region) {
                return null;
            }
            const buffer = source.bufferFor(region);
            return buffer ? { buffer, rate: playbackRateFor(pitch, region.keyCentre) } : null;
        },
    };
}

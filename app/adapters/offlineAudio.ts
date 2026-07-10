// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { RecordedNote } from "../../core/composition";
import { LEAD_IN_MS, videoDurationMs } from "../../core/videoFrames";
import { renderStrike } from "./webAudioEngine";

// Renders a take's audio deterministically for the video export: every note
// struck into an OfflineAudioContext with the live synth's own voice, faster
// than real time and without touching the page's shared audio context. The
// timeline matches core/videoFrames — the lead-in of stillness, then the
// notes on their own clock — so the encoder can zip frames and samples
// together with no further alignment.

export const EXPORT_SAMPLE_RATE = 48_000;

// The gain the in-app replay would use at full volume; the export ignores the
// player's volume preference — a shared video shouldn't be quiet because the
// exporter practises quietly.
const REPLAY_GAIN = 0.32;

export function renderTakeAudio(
    notes: RecordedNote[],
    sampleRate: number = EXPORT_SAMPLE_RATE,
): Promise<AudioBuffer> {
    const durationS = videoDurationMs(notes) / 1000;
    const ctx = new OfflineAudioContext(2, Math.ceil(durationS * sampleRate), sampleRate);
    for (const note of notes) {
        renderStrike(ctx, {
            note: note.pitch,
            gain: (note.velocity / 127) * REPLAY_GAIN,
            duration: note.durationMs / 1000,
            delay: (LEAD_IN_MS + note.startMs) / 1000,
        });
    }
    return ctx.startRendering();
}

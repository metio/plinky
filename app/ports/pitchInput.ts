// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { CalibrationSample } from "../../core/micCalibration";
import type { MicCalibration, PitchEvent } from "../../core/pitch";

// The microphone seam: everything that hears the room lives behind this port,
// so the note funnel receives plain pitch events and a test hands it a fake
// that emits them on cue — no getUserMedia, no audio graph.

export type PitchStartResult = "listening" | "denied" | "error";

export type PitchStartOptions = {
    // The player's tuning, threaded into the live detector so notes and their
    // velocities read against their own room. Omitted during calibration itself,
    // whose whole job is to measure the RAW detector.
    calibration?: MicCalibration;
    // Raw per-frame telemetry — loudness and the notes heard — over the very
    // same audio graph the note events come from. The calibration wizard listens
    // here; normal play leaves it unset. Calibrating a different chain than the
    // one that plays would be worthless, so there is deliberately one graph.
    onSample?: (sample: CalibrationSample) => void;
};

export interface PitchInput {
    // Whether this environment can listen at all (a microphone API exists).
    supported(): boolean;
    // Ask for the microphone and start streaming note events. Resolves with the
    // outcome; "denied" is the player saying no, "error" is everything else.
    start(
        onEvent: (event: PitchEvent) => void,
        options?: PitchStartOptions,
    ): Promise<PitchStartResult>;
    // Stop listening and release the microphone. Idempotent.
    stop(): void;
}

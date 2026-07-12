// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { PitchEvent } from "../../core/pitch";

// The microphone seam: everything that hears the room lives behind this port,
// so the note funnel receives plain pitch events and a test hands it a fake
// that emits them on cue — no getUserMedia, no audio graph.

export type PitchStartResult = "listening" | "denied" | "error";

export interface PitchInput {
    // Whether this environment can listen at all (a microphone API exists).
    supported(): boolean;
    // Ask for the microphone and start streaming note events. Resolves with the
    // outcome; "denied" is the player saying no, "error" is everything else.
    start(onEvent: (event: PitchEvent) => void): Promise<PitchStartResult>;
    // Stop listening and release the microphone. Idempotent.
    stop(): void;
}

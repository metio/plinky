// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { PitchEvent } from "../../core/pitch";
import type { PitchInput, PitchStartResult } from "../ports/pitchInput";

// A hand-cranked microphone for tests: `emit` plays a detected note into
// whatever is listening, and the start outcome is scriptable so denied/error
// paths are one line to exercise.
export type FakePitch = PitchInput & {
    emit(event: PitchEvent): void;
    listening(): boolean;
};

export function fakePitch(result: PitchStartResult = "listening"): FakePitch {
    let listener: ((event: PitchEvent) => void) | null = null;
    return {
        supported: () => true,
        async start(onEvent) {
            if (result === "listening") {
                listener = onEvent;
            }
            return result;
        },
        stop() {
            listener = null;
        },
        emit(event) {
            listener?.(event);
        },
        listening: () => listener !== null,
    };
}

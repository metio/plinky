// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { CalibrationSample } from "../../core/micCalibration";
import type { MicCalibration, PitchEvent } from "../../core/pitch";
import type { PitchInput, PitchStartOptions, PitchStartResult } from "../ports/pitchInput";

// A hand-cranked microphone for tests: `emit` plays a detected note into
// whatever is listening, `emitSample` feeds the raw telemetry the calibration
// wizard reads, and the start outcome is scriptable so denied/error paths are
// one line to exercise.
export type FakePitch = PitchInput & {
    emit(event: PitchEvent): void;
    emitSample(sample: CalibrationSample): void;
    listening(): boolean;
    // The calibration the last start() was handed, for asserting the live path
    // received the player's tuning.
    lastCalibration(): MicCalibration | undefined;
};

export function fakePitch(result: PitchStartResult = "listening"): FakePitch {
    let listener: ((event: PitchEvent) => void) | null = null;
    let sampler: ((sample: CalibrationSample) => void) | null = null;
    let calibration: MicCalibration | undefined;
    return {
        supported: () => true,
        async start(onEvent, options?: PitchStartOptions) {
            if (result === "listening") {
                listener = onEvent;
                sampler = options?.onSample ?? null;
                calibration = options?.calibration;
            }
            return result;
        },
        stop() {
            listener = null;
            sampler = null;
        },
        emit(event) {
            listener?.(event);
        },
        emitSample(sample) {
            sampler?.(sample);
        },
        listening: () => listener !== null,
        lastCalibration: () => calibration,
    };
}

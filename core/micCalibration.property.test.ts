// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
    beginCalibration,
    type CalibrationSample,
    deriveCalibration,
    nextStep,
    observe,
} from "./micCalibration";
import { levelToVelocity } from "./pitch";

const rmsArb = fc.double({ min: 0, max: 0.5, noNaN: true });
const sampleArb: fc.Arbitrary<CalibrationSample> = fc.record({
    rms: rmsArb,
    notes: fc.array(fc.integer({ min: 21, max: 108 }), { maxLength: 3 }),
});
const stepFramesArb = fc.array(sampleArb, { maxLength: 40 });

function runFrom(
    quiet: CalibrationSample[],
    note: CalibrationSample[],
    soft: CalibrationSample[],
    loud: CalibrationSample[],
    targetNote: number,
) {
    let state = beginCalibration(targetNote);
    for (const group of [quiet, note, soft, loud]) {
        for (const sample of group) {
            state = observe(state, sample);
        }
        state = nextStep(state);
    }
    return deriveCalibration(state);
}

describe("deriveCalibration properties", () => {
    it("always yields a usable, non-degenerate calibration", () => {
        fc.assert(
            fc.property(
                stepFramesArb,
                stepFramesArb,
                stepFramesArb,
                stepFramesArb,
                fc.integer({ min: 48, max: 72 }),
                (quiet, note, soft, loud, target) => {
                    const cal = runFrom(quiet, note, soft, loud, target);
                    // Every field stays in a sane, bounded range…
                    expect(cal.noiseFloor).toBeGreaterThan(0);
                    expect(cal.noiseFloor).toBeLessThanOrEqual(0.2);
                    expect(cal.softLevel).toBeGreaterThan(0);
                    expect(Number.isInteger(cal.octaveShift)).toBe(true);
                    expect(Math.abs(cal.octaveShift)).toBeLessThanOrEqual(2);
                    // …and the loud anchor never collapses onto the soft one, so
                    // the velocity map spans a real range rather than dividing by
                    // zero: the ceiling reads harder than the floor.
                    expect(cal.loudLevel).toBeGreaterThan(cal.softLevel);
                    expect(levelToVelocity(cal.loudLevel, cal)).toBeGreaterThan(
                        levelToVelocity(cal.softLevel, cal),
                    );
                },
            ),
        );
    });
});

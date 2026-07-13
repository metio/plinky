// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import {
    beginCalibration,
    type CalibrationSample,
    deriveCalibration,
    heardNote,
    nextStep,
    observe,
    stepProgress,
    stepReady,
} from "./micCalibration";

// Drive a whole calibration run from scripted per-step frames, advancing each
// step the moment it is satisfied — exactly what the wizard does live.
function run(script: {
    quiet: CalibrationSample[];
    note: CalibrationSample[];
    soft: CalibrationSample[];
    loud: CalibrationSample[];
    targetNote?: number;
}) {
    let state = beginCalibration(script.targetNote ?? 60);
    for (const step of ["quiet", "note", "soft", "loud"] as const) {
        for (const sample of script[step]) {
            state = observe(state, sample);
        }
        state = nextStep(state);
    }
    return state;
}

const frames = (n: number, sample: CalibrationSample): CalibrationSample[] =>
    Array.from({ length: n }, () => sample);

describe("calibration steps", () => {
    it("walks quiet → note → soft → loud → done", () => {
        let state = beginCalibration();
        expect(state.step).toBe("quiet");
        state = nextStep(state);
        expect(state.step).toBe("note");
        state = nextStep(nextStep(state));
        expect(state.step).toBe("loud");
        state = nextStep(state);
        expect(state.step).toBe("done");
        // Done is the end of the line.
        expect(nextStep(state).step).toBe("done");
    });

    it("only counts note-bearing frames toward the loudness steps", () => {
        let state = beginCalibration();
        state = nextStep(nextStep(state)); // → soft
        state = observe(state, { rms: 0.05, notes: [] }); // silence, ignored
        expect(stepProgress(state)).toBe(0);
        state = observe(state, { rms: 0.05, notes: [60] });
        expect(stepProgress(state)).toBeGreaterThan(0);
    });

    it("reports the steadily-heard note during the pitch step", () => {
        let state = nextStep(beginCalibration()); // → note
        state = observe(state, { rms: 0.1, notes: [48] });
        state = observe(state, { rms: 0.1, notes: [48] });
        state = observe(state, { rms: 0.1, notes: [72] }); // one stray frame
        expect(heardNote(state)).toBe(48);
    });

    it("marks a step ready once it has heard enough", () => {
        let state = beginCalibration();
        expect(stepReady(state)).toBe(false);
        for (const sample of frames(30, { rms: 0.002, notes: [] })) {
            state = observe(state, sample);
        }
        expect(stepReady(state)).toBe(true);
        expect(stepProgress(state)).toBe(1);
    });
});

describe("deriveCalibration", () => {
    it("sets a noise floor above a noisy room's ambient level", () => {
        const cal = run({
            quiet: frames(30, { rms: 0.03, notes: [] }),
            note: frames(12, { rms: 0.2, notes: [60] }),
            soft: frames(15, { rms: 0.05, notes: [60] }),
            loud: frames(15, { rms: 0.25, notes: [60] }),
        });
        const result = deriveCalibration(cal);
        expect(result.noiseFloor).toBeGreaterThan(0.03);
    });

    it("corrects a mic that hears the target an octave low", () => {
        const cal = run({
            quiet: frames(30, { rms: 0.002, notes: [] }),
            note: frames(12, { rms: 0.2, notes: [48] }), // plays C4, heard as C3
            soft: frames(15, { rms: 0.05, notes: [48] }),
            loud: frames(15, { rms: 0.25, notes: [48] }),
            targetNote: 60,
        });
        expect(deriveCalibration(cal).octaveShift).toBe(1);
    });

    it("anchors the velocity band on the measured soft and loud strikes", () => {
        const cal = run({
            quiet: frames(30, { rms: 0.002, notes: [] }),
            note: frames(12, { rms: 0.2, notes: [60] }),
            soft: frames(15, { rms: 0.02, notes: [60] }),
            loud: frames(15, { rms: 0.18, notes: [60] }),
        });
        const result = deriveCalibration(cal);
        expect(result.softLevel).toBeCloseTo(0.02, 3);
        expect(result.loudLevel).toBeGreaterThan(result.softLevel);
    });

    it("falls back to safe defaults when a run heard nothing", () => {
        const empty = run({ quiet: [], note: [], soft: [], loud: [] });
        const result = deriveCalibration(empty);
        expect(result.octaveShift).toBe(0);
        expect(result.loudLevel).toBeGreaterThan(result.softLevel);
        expect(result.noiseFloor).toBeGreaterThan(0);
    });

    it("keeps the loud anchor clear of the soft one even on inverted data", () => {
        const cal = run({
            quiet: frames(30, { rms: 0.002, notes: [] }),
            note: frames(12, { rms: 0.2, notes: [60] }),
            soft: frames(15, { rms: 0.2, notes: [60] }), // player leaned on "soft"
            loud: frames(15, { rms: 0.05, notes: [60] }), // and eased on "loud"
        });
        const result = deriveCalibration(cal);
        expect(result.loudLevel).toBeGreaterThan(result.softLevel);
    });
});

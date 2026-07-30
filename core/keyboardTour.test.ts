// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import {
    awaited,
    beginTour,
    currentStep,
    isBlackKey,
    isDone,
    MIDDLE_C,
    nextStep,
    observe,
    stepReady,
    TOUR_STEPS,
    tourProgress,
} from "./keyboardTour";

// Plays a list of notes into the tour, one after another.
const play = (notes: number[], from = beginTour()) => notes.reduce(observe, from);

describe("isBlackKey", () => {
    it("knows the five black keys of an octave", () => {
        const octave = Array.from({ length: 12 }, (_, i) => MIDDLE_C + i);
        expect(octave.filter(isBlackKey)).toEqual([61, 63, 66, 68, 70]);
    });

    it("says the same about every octave, including below zero", () => {
        expect(isBlackKey(1)).toBe(true);
        expect(isBlackKey(MIDDLE_C - 12 + 1)).toBe(true);
        expect(isBlackKey(MIDDLE_C - 12)).toBe(false);
    });
});

describe("the tour", () => {
    it("opens on the black-key groups, before any notation", () => {
        const state = beginTour();

        expect(currentStep(state)?.id).toBe("blackGroups");
        // The first four steps teach the keyboard itself; nothing here may assume the
        // reader can read music.
        expect(TOUR_STEPS.slice(0, 4).every((step) => step.staff === undefined)).toBe(true);
    });

    it("takes any black key for the group step", () => {
        for (const note of [61, 63, 66, 68, 70]) {
            expect(stepReady(play([note]))).toBe(true);
        }
        expect(stepReady(play([MIDDLE_C]))).toBe(false);
    });

    it("wants the one landmark note for middle C", () => {
        const atC = nextStep(play([61]));

        expect(currentStep(atC)?.id).toBe("middleC");
        expect(stepReady(observe(atC, 62))).toBe(false);
        expect(stepReady(observe(atC, MIDDLE_C))).toBe(true);
    });

    it("walks the white keys in order", () => {
        const run = nextStep(nextStep(play([61])));
        expect(currentStep(run)?.id).toBe("whiteRun");

        const walked = play([60, 62, 64, 65, 67, 69, 71, 72], run);
        expect(stepReady(walked)).toBe(true);
    });

    it("ignores a wrong press instead of undoing progress", () => {
        // Getting it wrong is how a piano gets learned. A tour that restarted eight
        // notes over one slip would teach the wrong thing about this app.
        const run = nextStep(nextStep(play([61])));
        const partway = play([60, 62, 64], run);

        const wandered = play([63, 71, 61, 40, 99], partway);

        expect(wandered).toEqual(partway);
        expect(stepReady(play([65, 67, 69, 71, 72], wandered))).toBe(true);
    });

    it("prompts only the next key, not the whole sequence", () => {
        const run = nextStep(nextStep(play([61])));

        expect(awaited(run)).toEqual([60]);
        expect(awaited(observe(run, 60))).toEqual([62]);
    });

    it("prompts nothing when any key will do", () => {
        // The group step is satisfied by whichever black key the reader's finger finds,
        // so lighting one particular key would contradict what it is asking.
        expect(awaited(beginTour())).toEqual([]);
    });

    it("runs out after the last step and stays there", () => {
        let state = beginTour();
        for (const step of TOUR_STEPS) {
            for (const target of step.play) {
                state = observe(state, target.kind === "anyBlack" ? 61 : target.note);
            }
            expect(`${step.id}: ${stepReady(state)}`).toBe(`${step.id}: true`);
            state = nextStep(state);
        }

        expect(isDone(state)).toBe(true);
        expect(currentStep(state)).toBeNull();
        expect(tourProgress(state)).toBe(1);
        // Playing on after the end changes nothing.
        expect(observe(state, MIDDLE_C)).toEqual(state);
        expect(nextStep(state)).toEqual(state);
    });

    it("counts progress in steps, not presses", () => {
        // The white-key run is eight presses and the others are one; counting presses
        // would make it look like most of the tour.
        const start = beginTour();
        expect(tourProgress(start)).toBe(0);
        expect(tourProgress(nextStep(start))).toBeCloseTo(1 / TOUR_STEPS.length);
    });

    it("only ever puts natural keys on the staff", () => {
        // Spelling a black key means choosing between a sharp and a flat, which none of
        // these steps is teaching yet — so the staff steps stay on the white keys and
        // the drawing code never has to guess.
        for (const step of TOUR_STEPS) {
            for (const pitch of step.staff ?? []) {
                expect(`${step.id} ${pitch}: ${isBlackKey(pitch)}`).toBe(
                    `${step.id} ${pitch}: false`,
                );
            }
        }
    });

    it("gives every step something to play and something to look at", () => {
        for (const step of TOUR_STEPS) {
            expect(`${step.id} plays: ${step.play.length > 0}`).toBe(`${step.id} plays: true`);
            expect(`${step.id} lights: ${step.highlight.length > 0}`).toBe(
                `${step.id} lights: true`,
            );
        }
    });
});

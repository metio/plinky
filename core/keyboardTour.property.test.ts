// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
    awaited,
    beginTour,
    currentStep,
    isDone,
    nextStep,
    observe,
    stepReady,
    TOUR_STEPS,
    type TourState,
    tourProgress,
} from "./keyboardTour";

// Any key a hand can land on, well outside the tour's own octave so wandering is
// genuinely random rather than a walk along the answer.
const noteArb = fc.integer({ min: 21, max: 108 });
const notesArb = fc.array(noteArb, { maxLength: 60 });
const stepIndexArb = fc.integer({ min: 0, max: TOUR_STEPS.length - 1 });

const atStep = (index: number): TourState => ({ step: index, matched: 0 });

describe("the tour, whatever is played at it", () => {
    it("never goes backwards", () => {
        // The promise the whole design rests on: no sequence of presses can cost a
        // learner progress they already made.
        fc.assert(
            fc.property(stepIndexArb, notesArb, (index, notes) => {
                let state = atStep(index);
                for (const note of notes) {
                    const next = observe(state, note);
                    expect(next.step).toBe(state.step);
                    expect(next.matched).toBeGreaterThanOrEqual(state.matched);
                    state = next;
                }
            }),
        );
    });

    it("never asks for more presses than the step has", () => {
        fc.assert(
            fc.property(stepIndexArb, notesArb, (index, notes) => {
                const state = notes.reduce(observe, atStep(index));
                const step = currentStep(state);
                expect(state.matched).toBeLessThanOrEqual(step?.play.length ?? 0);
            }),
        );
    });

    it("only advances on the key it is waiting for", () => {
        fc.assert(
            fc.property(stepIndexArb, noteArb, (index, note) => {
                const state = atStep(index);
                const moved = observe(state, note).matched > state.matched;
                const wanted = awaited(state);
                // Either the step named the key and this was it, or the step accepts a
                // whole class of keys (any black one) and named none.
                expect(moved ? wanted.length === 0 || wanted.includes(note) : true).toBe(true);
            }),
        );
    });

    it("can always be finished by playing what it asks for", () => {
        // However much wandering came first, the tour is never left unfinishable.
        fc.assert(
            fc.property(notesArb, (noise) => {
                let state = noise.reduce(observe, beginTour());
                while (!isDone(state)) {
                    const step = currentStep(state);
                    if (!step) {
                        break;
                    }
                    for (const target of step.play) {
                        state = observe(state, target.kind === "anyBlack" ? 61 : target.note);
                    }
                    expect(stepReady(state)).toBe(true);
                    state = nextStep(state);
                }
                expect(isDone(state)).toBe(true);
                expect(tourProgress(state)).toBe(1);
            }),
        );
    });

    it("keeps progress between none and all of it", () => {
        fc.assert(
            fc.property(stepIndexArb, notesArb, (index, notes) => {
                const progress = tourProgress(notes.reduce(observe, atStep(index)));
                expect(progress).toBeGreaterThanOrEqual(0);
                expect(progress).toBeLessThanOrEqual(1);
            }),
        );
    });
});

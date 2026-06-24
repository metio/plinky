// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import abcjs from "abcjs";
import { afterEach, describe, expect, it } from "vitest";
import { buildExercise, toAbcDocument } from "./songs";
import { buildSteps } from "./steps";

// Import validation and export both depend on abcjs's real-browser pitch data,
// so the round-trip is covered in browser mode.
let mounted: HTMLElement[] = [];

afterEach(() => {
    for (const element of mounted) {
        element.remove();
    }
    mounted = [];
});

function stepsOf(abc: string) {
    const element = document.createElement("div");
    document.body.appendChild(element);
    mounted.push(element);
    const tune = abcjs.renderAbc(element, abc, { add_classes: true })[0];
    return buildSteps(tune, 100);
}

describe("song import/export round-trip", () => {
    it("an imported melody yields playable steps", () => {
        expect(stepsOf("X:1\nT:Imp\nM:4/4\nL:1/4\nK:C\nC D E F |")).toHaveLength(4);
    });

    it("accepts a chord tune the generalized matcher can play", () => {
        const result = stepsOf("X:1\nT:Chords\nM:4/4\nL:1/4\nK:C\n[CEG] [DFA] |");
        expect(result).toHaveLength(2);
        expect(result[0]!.pitches).toEqual([60, 64, 67]);
    });

    it("export then re-import preserves the notes", () => {
        const exercise = buildExercise("X:1\nT:Imp\nM:4/4\nL:1/4\nK:C\nC E G c |", []);
        const reExported = toAbcDocument(exercise);
        expect(stepsOf(reExported).map((step) => step.pitches[0])).toEqual([60, 64, 67, 72]);
    });
});

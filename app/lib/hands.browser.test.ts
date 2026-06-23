// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import abcjs from "abcjs";
import { afterEach, describe, expect, it } from "vitest";
import { buildHands } from "./hands";

// buildHands depends on abcjs's real-browser pitch + startChar data, so it is
// covered in browser mode.
let mounted: HTMLElement[] = [];

afterEach(() => {
    for (const element of mounted) {
        element.remove();
    }
    mounted = [];
});

function hands(abc: string) {
    const element = document.createElement("div");
    document.body.appendChild(element);
    mounted.push(element);
    const tune = abcjs.renderAbc(element, abc, { add_classes: true })[0];
    return buildHands(tune, 100);
}

const GRAND_STAFF =
    "X:1\nM:4/4\nL:1/4\nV:1 clef=treble\nV:2 clef=bass\nV:1\nK:C\nc d e f |\nV:2\nC2 G2 |";

describe("buildHands", () => {
    it("splits a grand staff into a right and left hand", () => {
        const result = hands(GRAND_STAFF);
        expect(result.map((hand) => hand.label)).toEqual(["Right", "Left"]);
        // Right hand: c d e f. Left hand: half-note C then G.
        expect(result[0].steps.map((step) => step.pitches)).toEqual([[72], [74], [76], [77]]);
        expect(result[1].steps.map((step) => step.pitches)).toEqual([[60], [67]]);
    });

    it("returns a single hand for a single-staff tune", () => {
        const result = hands("X:1\nM:4/4\nL:1/4\nK:C\nC D E F |");
        expect(result).toHaveLength(1);
        expect(result[0].steps.map((step) => step.pitches)).toEqual([[60], [62], [64], [65]]);
    });
});

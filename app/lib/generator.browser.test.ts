// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import abcjs from "abcjs";
import { afterEach, describe, expect, it } from "vitest";
import { generatePhrase } from "./generator";
import { buildHands } from "./hands";

// The generator's value is that its ABC is actually playable, so render it and
// confirm buildHands produces the expected hands and note counts.
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
    return buildHands(tune, 90);
}

describe("generated phrases are playable", () => {
    it("a single-hand phrase yields one hand with a step per beat", () => {
        const abc = generatePhrase({ bars: 2, beatsPerBar: 4, twoHands: false }, () => 0);
        const result = hands(abc);
        expect(result).toHaveLength(1);
        expect(result[0]!.steps).toHaveLength(8);
    });

    it("a two-hand phrase splits into a right and left hand", () => {
        const abc = generatePhrase({ bars: 1, beatsPerBar: 4, twoHands: true }, () => 0);
        const result = hands(abc);
        expect(result.map((hand) => hand.label)).toEqual(["Right", "Left"]);
        expect(result[0]!.steps).toHaveLength(4);
        expect(result[1]!.steps).toHaveLength(4);
    });
});

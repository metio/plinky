// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import abcjs from "abcjs";
import { afterEach, describe, expect, it } from "vitest";
import { buildHands } from "./hands";
import { musicXmlToAbc } from "./musicxml";

// The point of the converter is that its ABC is playable, so render the converted
// output and confirm buildHands produces the expected pitches.
let mounted: HTMLElement[] = [];

afterEach(() => {
    for (const element of mounted) {
        element.remove();
    }
    mounted = [];
});

function note(step: string, octave: number, duration = 1, extra = ""): string {
    return `<note>${extra}<pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>${duration}</duration></note>`;
}

function score(body: string): string {
    return `<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1"><attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>${body}</measure></part></score-partwise>`;
}

function hands(abc: string) {
    const element = document.createElement("div");
    document.body.appendChild(element);
    mounted.push(element);
    const tune = abcjs.renderAbc(element, abc, { add_classes: true })[0];
    return buildHands(tune, 90);
}

describe("MusicXML import round-trip", () => {
    it("a converted melody plays the right pitches", () => {
        const abc = musicXmlToAbc(score(note("C", 4) + note("D", 4) + note("E", 4) + note("F", 4)));
        const result = hands(abc);
        expect(result).toHaveLength(1);
        expect(result[0].steps.map((step) => step.pitches)).toEqual([[60], [62], [64], [65]]);
    });

    it("a converted chord plays as one step", () => {
        const chord = note("C", 4, 4) + note("E", 4, 4, "<chord/>") + note("G", 4, 4, "<chord/>");
        const result = hands(musicXmlToAbc(score(chord)));
        expect(result[0].steps[0].pitches).toEqual([60, 64, 67]);
    });

    it("plays a natural after a sharp at the right pitch", () => {
        const sharp = `<note><pitch><step>F</step><alter>1</alter><octave>4</octave></pitch><duration>1</duration></note>`;
        const natural = `<note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration></note>`;
        const result = hands(musicXmlToAbc(score(sharp + natural)));
        expect(result[0].steps.map((step) => step.pitches)).toEqual([[66], [65]]);
    });
});

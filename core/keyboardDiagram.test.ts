// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { svgKeyboardDiagram } from "./keyboardDiagram";
import { chordPitches } from "./theory";

const C_MAJOR = chordPitches(60, "major");

const marks = (svg: string) => svg.match(/<circle/g)?.length ?? 0;
const keys = (svg: string) => svg.match(/<rect/g)?.length ?? 0;

describe("svgKeyboardDiagram", () => {
    it("is a self-contained document, so it rasterises with no stylesheet", () => {
        const svg = svgKeyboardDiagram({ from: 60, to: 72, keys: [] });
        expect(svg.startsWith("<svg xmlns=")).toBe(true);
        expect(svg.endsWith("</svg>")).toBe(true);
        expect(svg).not.toContain("class=");
        expect(svg).not.toContain("var(--");
    });

    it("draws one key per note of the span, plus the ground", () => {
        // 60..72 is 13 notes; the background rect makes 14.
        expect(keys(svgKeyboardDiagram({ from: 60, to: 72, keys: [] }))).toBe(14);
    });

    it("marks the notes it is given and nothing else", () => {
        expect(marks(svgKeyboardDiagram({ from: 60, to: 72, keys: [] }))).toBe(0);
        expect(
            marks(
                svgKeyboardDiagram({ from: 60, to: 72, keys: C_MAJOR.map((note) => ({ note })) }),
            ),
        ).toBe(3);
    });

    it("marks a black key as readily as a white one", () => {
        const svg = svgKeyboardDiagram({ from: 60, to: 72, keys: [{ note: 61 }] });
        expect(marks(svg)).toBe(1);
    });

    it("writes the finger on the mark when there is one to write", () => {
        const bare = svgKeyboardDiagram({ from: 60, to: 72, keys: [{ note: 60 }] });
        const fingered = svgKeyboardDiagram({ from: 60, to: 72, keys: [{ note: 60, finger: 1 }] });
        expect(bare).not.toContain(">1</text>");
        expect(fingered).toContain(">1</text>");
    });

    it("names the white keys only when asked", () => {
        const plain = svgKeyboardDiagram({ from: 60, to: 72, keys: [] });
        const named = svgKeyboardDiagram({ from: 60, to: 72, keys: [], noteNames: true });
        expect(plain).not.toContain(">C</text>");
        expect(named).toContain(">C</text>");
    });

    it("spells the names the way the reader asked", () => {
        const sharps = svgKeyboardDiagram({ from: 60, to: 72, keys: [], noteNames: true });
        const flats = svgKeyboardDiagram({
            from: 60,
            to: 72,
            keys: [],
            noteNames: true,
            spelling: "flat",
        });
        // The white keys are named the same either way; what matters is that the choice
        // reaches the drawing rather than being ignored.
        expect(sharps).toContain(">C</text>");
        expect(flats).toContain(">C</text>");
    });

    it("carries a caption, escaped, so a title cannot break the document", () => {
        const svg = svgKeyboardDiagram({
            from: 60,
            to: 72,
            keys: [],
            caption: 'C <major> & "friends"',
        });
        expect(svg).toContain("C &lt;major&gt; &amp; &quot;friends&quot;");
        expect(svg).not.toContain("<major>");
    });

    it("shrinks a long caption rather than letting it run off both edges", () => {
        // A centred caption too wide for the picture loses BOTH its ends, and the
        // languages that happens in are the ones this was added for.
        const sizeOf = (svg: string) =>
            Number(/font-size="([\d.]+)" font-weight="600"/.exec(svg)?.[1]);
        const short = svgKeyboardDiagram({ from: 60, to: 72, keys: [], caption: "C major" });
        const long = svgKeyboardDiagram({
            from: 60,
            to: 72,
            keys: [],
            caption: "Fis-Dur-Septakkord mit großer Septime — rechte Hand, zweite Umkehrung",
        });
        expect(sizeOf(long)).toBeLessThan(sizeOf(short));
        // And what it shrank to still fits the picture it sits in.
        expect(sizeOf(long) * 0.55 * 68).toBeLessThanOrEqual(1200);
    });

    it("grows taller for a caption and stays put without one", () => {
        const bare = svgKeyboardDiagram({ from: 60, to: 72, keys: [] });
        const captioned = svgKeyboardDiagram({ from: 60, to: 72, keys: [], caption: "C major" });
        const heightOf = (svg: string) => Number(/height="(\d+)"/.exec(svg)?.[1]);
        expect(heightOf(captioned)).toBeGreaterThan(heightOf(bare));
    });

    it("lifts a mark clear of the note name it would otherwise cover", () => {
        // A reader who does not know the keyboard came for the letter; a circle sitting
        // on top of it takes away the only thing the picture was going to tell them.
        const cyOf = (svg: string) => Number(/<circle cx="[\d.]+" cy="([\d.]+)"/.exec(svg)?.[1]);
        const plain = svgKeyboardDiagram({ from: 60, to: 72, keys: [{ note: 60 }] });
        const named = svgKeyboardDiagram({
            from: 60,
            to: 72,
            keys: [{ note: 60 }],
            noteNames: true,
        });
        expect(cyOf(named)).toBeLessThan(cyOf(plain));
    });

    it("ignores a note outside the span rather than drawing it off the edge", () => {
        const svg = svgKeyboardDiagram({ from: 60, to: 72, keys: [{ note: 48 }, { note: 60 }] });
        expect(marks(svg)).toBe(1);
    });

    it("draws the black keys after the white ones, as a keyboard is built", () => {
        // A black key drawn first would be painted over by its white neighbours.
        const svg = svgKeyboardDiagram({ from: 60, to: 62, keys: [] });
        const white = svg.indexOf('height="300"');
        const black = svg.indexOf('height="186"');
        expect(white).toBeLessThan(black);
    });
});

// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { glissandoNotes, readGlissandos } from "./glissando";

const pitches = (notes: { pitch: number }[]) => notes.map((one) => one.pitch);
const total = (notes: { quarters: number }[]) => notes.reduce((sum, one) => sum + one.quarters, 0);

describe("glissandoNotes", () => {
    it("sweeps the keys under the hand, not every semitone", () => {
        // A piano gliss is a fingernail dragged across the keys. In C that is the white
        // ones — sweeping every semitone would be a chromatic run, a different gesture
        // played with a different hand.
        expect(pitches(glissandoNotes(60, 72, 1, 0))).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
    });

    it("sounds both notes the score actually wrote", () => {
        const swept = pitches(glissandoNotes(60, 67, 1, 0));
        expect(swept[0]).toBe(60);
        expect(swept.at(-1)).toBe(67);
    });

    it("sweeps downward when the score does", () => {
        const swept = pitches(glissandoNotes(72, 60, 1, 0));
        expect(swept[0]).toBe(72);
        expect(swept.at(-1)).toBe(60);
        expect(swept).toEqual([...swept].sort((one, other) => other - one));
    });

    it("follows the key the piece is in", () => {
        // Three flats: the sweep takes E flat rather than E natural.
        const swept = pitches(glissandoNotes(60, 72, 1, -3));
        expect(swept).toContain(63);
        expect(swept).not.toContain(64);
    });

    it("starts on a written accidental even when the key does not contain it", () => {
        // A gliss written from F sharp in C major starts on F sharp — that is the note on
        // the page and the key the hand begins on.
        const swept = pitches(glissandoNotes(66, 72, 1, 0));
        expect(swept[0]).toBe(66);
        expect(swept.at(-1)).toBe(72);
    });

    it("fills exactly the time the written note had", () => {
        for (const quarters of [0.5, 1, 2.5]) {
            expect(total(glissandoNotes(60, 79, quarters, 0))).toBeCloseTo(quarters);
        }
    });

    it("thins a long sweep instead of arriving late or scheduling hundreds", () => {
        // A gliss across the instrument in a quaver: a gesture of the right length beats a
        // complete scale that overruns it.
        const swept = glissandoNotes(21, 108, 0.5, 0);
        expect(swept.length).toBeLessThanOrEqual(60);
        expect(total(swept)).toBeCloseTo(0.5);
        expect(swept[0]?.pitch).toBe(21);
        expect(swept.at(-1)?.pitch).toBe(108);
    });

    it("has nothing to sweep between a note and itself", () => {
        expect(glissandoNotes(60, 60, 1, 0)).toEqual([]);
        expect(glissandoNotes(60, 72, 0, 0)).toEqual([]);
    });

    it("never repeats a pitch when thinning", () => {
        // Thinning rounds into the original list, and two rounded indices can land on one
        // note — a repeated key in a gliss is an audible stumble.
        const swept = pitches(glissandoNotes(60, 64, 2, 0));
        expect(new Set(swept).size).toBe(swept.length);
    });
});

const note = (
    whole: number,
    midi: number | null,
    glissando: "start" | "stop" | null,
    wholes = 0.5,
) => ({
    whole,
    wholes,
    midi,
    marks: { glissandos: glissando === null ? [] : [{ type: glissando }] },
});

describe("readGlissandos", () => {
    it("reads the sweep and the note it arrives on", () => {
        expect(readGlissandos([note(0, 60, "start"), note(0.5, 72, "stop")])).toEqual([
            { from: 0, to: 1, arrivesAt: 72, pitch: 60 },
        ]);
    });

    it("ignores a sweep the file opens and never closes", () => {
        expect(readGlissandos([note(0, 60, "start")])).toEqual([]);
    });

    it("ignores an unmarked note and a rest", () => {
        expect(readGlissandos([note(0, 60, null), note(1, null, "stop")])).toEqual([]);
    });

    it("ends a sweep in the part it starts in", () => {
        const inPart = (
            part: string,
            whole: number,
            midi: number,
            glissando: "start" | "stop",
        ) => ({
            ...note(whole, midi, glissando),
            part,
        });
        expect(
            readGlissandos([
                inPart("Piano", 0, 60, "start"),
                inPart("Voice", 0.25, 67, "stop"),
                inPart("Piano", 0.5, 72, "stop"),
            ]),
        ).toEqual([{ from: 0, to: 1, arrivesAt: 72, pitch: 60 }]);
    });

    // Both hands of one piano part sweep at once: the right hand up from C5 to C6, the left
    // down from C3 to C2. The left hand lands first, so the stops come in the opposite order
    // to the starts.
    const numbered = (
        whole: number,
        midi: number,
        glissando: "start" | "stop",
        glissandoNumber?: string,
    ) => ({
        ...note(whole, midi, glissando, 0.25),
        part: "P1",
        marks: {
            glissandos: [
                {
                    type: glissando,
                    ...(glissandoNumber === undefined ? {} : { number: glissandoNumber }),
                },
            ],
        },
    });

    it("lands each of two sweeps at once on its own note, paired by number", () => {
        expect(
            readGlissandos([
                numbered(0, 72, "start", "1"),
                numbered(0, 48, "start", "2"),
                numbered(0.5, 36, "stop", "2"),
                numbered(0.75, 84, "stop", "1"),
            ]),
        ).toEqual([
            { from: 0, to: 0.75, arrivesAt: 36, pitch: 48 },
            { from: 0, to: 1, arrivesAt: 84, pitch: 72 },
        ]);
    });

    it("pairs unnumbered sweeps the way the format's default number does", () => {
        // Without numbers every mark is number 1: the second start waits behind the first,
        // and the first stop closes the sweep already open.
        expect(
            readGlissandos([
                numbered(0, 72, "start"),
                numbered(0, 48, "start"),
                numbered(0.5, 36, "stop"),
                numbered(0.75, 84, "stop"),
            ]),
        ).toEqual([{ from: 0, to: 0.75, arrivesAt: 36, pitch: 72 }]);
        expect(readGlissandos([numbered(0, 72, "start", "1"), numbered(0.5, 84, "stop")])).toEqual([
            { from: 0, to: 0.75, arrivesAt: 84, pitch: 72 },
        ]);
    });

    it("keeps one number's sweeps in their own part", () => {
        expect(
            readGlissandos([
                numbered(0, 72, "start", "1"),
                { ...numbered(0.25, 67, "stop", "1"), part: "Voice" },
                numbered(0.5, 84, "stop", "1"),
            ]),
        ).toEqual([{ from: 0, to: 0.75, arrivesAt: 84, pitch: 72 }]);
    });

    // A note that ends one sweep and starts the next: up from C5 to G5, then from that G5
    // straight back down to C5.
    type Mark = { type: "start" | "stop"; number?: string };
    const start = (number?: string): Mark => ({
        type: "start",
        ...(number === undefined ? {} : { number }),
    });
    const stop = (number?: string): Mark => ({
        type: "stop",
        ...(number === undefined ? {} : { number }),
    });
    const marked = (whole: number, midi: number, ...glissandos: Mark[]) => ({
        whole,
        wholes: 0.25,
        midi,
        part: "P1",
        marks: { glissandos },
    });

    it("closes one sweep and opens the next on the note they share, in either order", () => {
        const numberings: [string | undefined, string | undefined][] = [
            [undefined, undefined],
            ["1", "1"],
            ["1", "2"],
            ["2", "1"],
        ];
        for (const [first, second] of numberings) {
            for (const onG of [
                [stop(first), start(second)],
                [start(second), stop(first)],
            ]) {
                expect(
                    readGlissandos([
                        marked(0, 72, start(first)),
                        marked(0.25, 79, ...onG),
                        marked(0.5, 72, stop(second)),
                    ]),
                ).toEqual([
                    { from: 0, to: 0.5, arrivesAt: 79, pitch: 72 },
                    { from: 0.25, to: 0.75, arrivesAt: 72, pitch: 79 },
                ]);
            }
        }
    });

    it("follows a chain of three sweeps", () => {
        expect(
            readGlissandos([
                marked(0, 72, start()),
                marked(0.25, 79, start("2"), stop()),
                marked(0.5, 72, start(), stop("2")),
                marked(0.75, 79, stop()),
            ]),
        ).toEqual([
            { from: 0, to: 0.5, arrivesAt: 79, pitch: 72 },
            { from: 0.25, to: 0.75, arrivesAt: 72, pitch: 79 },
            { from: 0.5, to: 1, arrivesAt: 79, pitch: 72 },
        ]);
    });

    it("never closes a sweep on the note it starts from", () => {
        // Nothing is open when the first note is reached, so its stop closes nothing and its
        // start opens the one sweep the file has.
        expect(readGlissandos([marked(0, 72, start(), stop()), marked(0.25, 79, stop())])).toEqual([
            { from: 0, to: 0.5, arrivesAt: 79, pitch: 72 },
        ]);
    });
});

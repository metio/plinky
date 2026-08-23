// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { readTempoPoints, tempoAt } from "./musicxmlMarks";
import { readTimeline } from "./musicxmlTimeline";

const parse = (xml: string): Document =>
    new DOMParser().parseFromString(xml, "application/xml") as unknown as Document;

// A part of `bars` whole-note bars, each carrying whatever directions are handed in for it.
const score = (bars: string[]): Document =>
    parse(
        `<score-partwise><part id="P1">${bars
            .map(
                (content, index) =>
                    `<measure number="${index + 1}">${
                        index === 0
                            ? "<attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>"
                            : ""
                    }${content}<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration></note></measure>`,
            )
            .join("")}</part></score-partwise>`,
    );

const words = (text: string) =>
    `<direction><direction-type><words>${text}</words></direction-type></direction>`;
const sound = (bpm: number) => `<direction><sound tempo="${bpm}"/></direction>`;

const pointsOf = (bars: string[]) => readTempoPoints(readTimeline(score(bars)));

describe("gradual tempo", () => {
    it("slides from the tempo in force toward the one stated next", () => {
        // A rit. that resolves: the score says where it lands, so nothing is guessed.
        const points = pointsOf([sound(120), words("rit."), "", sound(60)]);
        expect(tempoAt(points, 0)).toBe(120);
        expect(tempoAt(points, 1)).toBe(120);
        // Halfway between the rit. and the new mark, halfway between the two tempi.
        expect(tempoAt(points, 2)).toBeCloseTo(90);
        expect(tempoAt(points, 3)).toBe(60);
        expect(tempoAt(points, 10)).toBe(60);
    });

    it("gives an unresolved rit. somewhere to go", () => {
        // Most rits are never resolved — one before a repeat, one at a phrase end. Left
        // with no landing point the mark would do nothing at all, which is what it did
        // before: 30% of the catalogue prints one of these words and none of them sounded.
        const points = pointsOf([sound(100), words("rit."), "", ""]);
        expect(tempoAt(points, 1)).toBe(100);
        expect(tempoAt(points, 4)).toBeLessThan(100);
        expect(tempoAt(points, 4)).toBeGreaterThan(50);
    });

    it("speeds up for an accel. and slows for a rall.", () => {
        expect(tempoAt(pointsOf([sound(100), words("accel."), "", ""]), 3)).toBeGreaterThan(100);
        expect(tempoAt(pointsOf([sound(100), words("rall."), "", ""]), 3)).toBeLessThan(100);
    });

    it("goes back to the last stated tempo at 'a tempo'", () => {
        // Not to the last POINT: a ramp's own opening point holds the tempo it is leaving,
        // and a resume that landed there would restore nothing.
        const points = pointsOf([sound(120), words("rit."), words("a tempo"), ""]);
        expect(tempoAt(points, 2)).toBe(120);
        expect(tempoAt(points, 3)).toBe(120);
        // …and the middle of the rit. is genuinely slower, so the ramp did happen.
        expect(tempoAt(points, 1.5)).toBeLessThan(120);
    });

    it("recognises the spellings engravings actually use", () => {
        for (const word of ["rit.", "Ritard.", "ritardando", "rall.", "allarg."]) {
            expect(tempoAt(pointsOf([sound(100), words(word), "", ""]), 3)).toBeLessThan(100);
        }
        for (const word of ["accel.", "Accelerando", "stringendo"]) {
            expect(tempoAt(pointsOf([sound(100), words(word), "", ""]), 3)).toBeGreaterThan(100);
        }
        for (const word of ["a tempo", "Tempo I", "tempo primo"]) {
            const points = pointsOf([sound(120), words("rit."), words(word), ""]);
            expect(tempoAt(points, 2)).toBe(120);
        }
    });

    it("leaves a sudden ritenuto alone", () => {
        // riten. is a DROP to a new tempo, not a slide toward one. Treating it as a ramp
        // would spread over bars a thing the score asks for at once — so until it is read
        // properly it does nothing, which is at least not wrong.
        const points = pointsOf([sound(100), words("riten."), "", ""]);
        expect(tempoAt(points, 3)).toBe(100);
    });

    it("ignores a tempo word before the piece has stated any tempo", () => {
        // Nothing to move away from and nothing to go back to. A ramp from a guessed
        // starting tempo would be inventing the piece's speed, not reading it.
        expect(pointsOf([words("rit."), "", ""])).toEqual([]);
    });

    it("does not open a second ramp inside one already running", () => {
        // Engravings write "rit." and then "poco rit." a bar later. One give in the pulse
        // is what is meant; two nested ramps would compound into a halt.
        const points = pointsOf([sound(120), words("rit."), words("rit."), sound(60)]);
        expect(points.filter((point) => point.ramp)).toHaveLength(1);
    });

    it("keeps its points in the order they sound", () => {
        // An unresolved ramp puts a provisional landing point at the END of the piece, and
        // anything the score states afterwards has to come in front of it — or the ramp
        // would slide toward the end of the piece rather than toward the next mark.
        const points = pointsOf([sound(120), words("rit."), "", sound(60)]);
        expect(points.map((point) => point.whole)).toEqual(
            [...points.map((point) => point.whole)].sort((one, other) => one - other),
        );
    });
});

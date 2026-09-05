// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { keyLane } from "./keyboardGeometry";
import { attributionFor } from "./attribution";
import {
    boxInWindow,
    highwayBlocks,
    licenseLine,
    playedStepCount,
    provenanceLine,
    sceneKeys,
    sceneRange,
    scorePanelRect,
    scoreWindowTop,
    stepCenterAt,
    wrapTitle,
} from "./videoScene";

describe("sceneRange", () => {
    it("snaps outward to whole octaves around the take's pitches", () => {
        // D4 (62) to G5 (79) → C4 (60) to B5 (83).
        expect(sceneRange([62, 79])).toEqual({ from: 60, to: 83 });
    });

    it("widens a narrow take to at least two octaves", () => {
        const { from, to } = sceneRange([60]);
        expect(to - from).toBeGreaterThanOrEqual(23);
        expect(from % 12).toBe(0);
        expect(to % 12).toBe(11);
    });
});

describe("sceneKeys", () => {
    const keys = sceneKeys(60, 71); // one octave, C4..B4

    it("lays seven even white keys and five straddling black keys per octave", () => {
        expect(keys.filter((k) => !k.black)).toHaveLength(7);
        expect(keys.filter((k) => k.black)).toHaveLength(5);
        const whites = keys.filter((k) => !k.black);
        for (const key of whites) {
            expect(key.width).toBeCloseTo(1 / 7);
        }
        // E–F and B–C have no black key between them.
        expect(keys.some((k) => k.pitch === 64 + 1 && k.black)).toBe(false);
    });

    it("keeps every key inside the unit strip", () => {
        for (const key of sceneKeys(36, 96)) {
            expect(key.x).toBeGreaterThanOrEqual(0);
            expect(key.x + key.width).toBeLessThanOrEqual(1.0001);
        }
    });
});

describe("provenanceLine", () => {
    it("carries composer and source", () => {
        const line = provenanceLine(
            attributionFor({ composer: "J. S. Bach", license: "cc0-1.0", source: "mutopia" }),
        );
        expect(line).toContain("J. S. Bach");
        expect(line).toContain("Mutopia Project");
        expect(line.split(" · ").length).toBeGreaterThanOrEqual(2);
        // The title is drawn above this line, not inside it — the painter puts it there,
        // and repeating it here is what this function exists to stop.
        expect(line).not.toContain("Menuet");
    });

    it("omits what a piece doesn't have rather than printing blanks", () => {
        // Nothing known about the piece leaves nothing to print; the painter then falls
        // back to the title so the frame still names what is being played.
        expect(provenanceLine(attributionFor({}))).toBe("");
    });

    it("leaves the licence to its own line", () => {
        // It used to be the last item here. A spelled-out licence name does not fit beside
        // a composer, so it moved down a line and this one carries who and where only.
        expect(provenanceLine(attributionFor({ composer: "Satie", license: "CC0-1.0" }))).toBe(
            "Satie",
        );
    });
});

describe("licenseLine", () => {
    it("spells the licence out rather than printing its code", () => {
        expect(licenseLine(attributionFor({ license: "CC-BY-SA-4.0" }))).toBe(
            "Creative Commons Attribution-ShareAlike 4.0 International",
        );
        expect(licenseLine(attributionFor({ license: "CC0-1.0" }))).toBe(
            "CC0 1.0 Universal Public Domain Dedication",
        );
    });

    it("has nothing to say about a piece whose licence is unknown", () => {
        // Empty rather than a guess: the painter draws no line, which is the right answer
        // for a piece whose terms the catalogue cannot vouch for.
        expect(licenseLine(attributionFor({}))).toBe("");
        expect(licenseLine(attributionFor({ license: "WTFPL" }))).toBe("");
    });
});

describe("highwayBlocks", () => {
    const keys = sceneKeys(60, 83);
    const note = (pitch: number, startMs: number, durationMs: number) => ({
        pitch,
        startMs,
        durationMs,
    });

    it("places a block in its key's lane, sized by duration", () => {
        // A note at 60 starting 1000ms ahead, lasting 500ms, window 2000ms.
        const [block] = highwayBlocks([note(60, 1000, 500)], keys, 0, 2000);
        const lane = keys.find((k) => k.pitch === 60)!;
        expect(block!.x).toBe(lane.x);
        expect(block!.width).toBe(lane.width);
        expect(block!.onsetFrac).toBeCloseTo(0.5); // 1000/2000
        expect(block!.endFrac).toBeCloseTo(0.75); // 1500/2000
    });

    it("hides a note that has fully passed the keys and one not yet in the window", () => {
        const notes = [note(60, 0, 200), note(62, 5000, 200)];
        // At t=400 the first note (ended at 200) is past; the second (at 5000) is
        // beyond a 2000ms window.
        expect(highwayBlocks(notes, keys, 400, 2000)).toEqual([]);
    });

    it("keeps a currently-sounding note visible with its onset below the line", () => {
        // Struck at 1000, 800ms long; at t=1200 it is sounding (onset passed).
        const [block] = highwayBlocks([note(60, 1000, 800)], keys, 1200, 2000);
        expect(block!.onsetFrac).toBeLessThan(0); // past the strike line
        expect(block!.endFrac).toBeGreaterThan(0); // tail still above it
    });

    it("drops a pitch with no key in range", () => {
        expect(highwayBlocks([note(200, 0, 100)], keys, 0, 2000)).toEqual([]);
    });
});

describe("scorePanelRect", () => {
    it("keeps the full band for a sheet taller than it", () => {
        // 1000-wide sheet at panel width 500 → half scale; 2000 tall → 1000 shown.
        expect(scorePanelRect({ y: 100, height: 300 }, 500, { width: 1000, height: 2000 })).toEqual(
            { y: 100, height: 300 },
        );
    });

    it("shrinks to a short sheet and centres it in the band", () => {
        // 1000×200 sheet at panel width 500 scales to 100 tall — the card hugs
        // the single system instead of trailing blank space.
        expect(scorePanelRect({ y: 100, height: 300 }, 500, { width: 1000, height: 200 })).toEqual({
            y: 200,
            height: 100,
        });
    });
});

describe("scoreWindowTop", () => {
    it("centres on the step and clamps to the image edges", () => {
        expect(scoreWindowTop(500, 400, 2000)).toBe(300);
        expect(scoreWindowTop(50, 400, 2000)).toBe(0);
        expect(scoreWindowTop(1950, 400, 2000)).toBe(1600);
    });

    it("pins to the top when the image is shorter than the window", () => {
        expect(scoreWindowTop(100, 400, 300)).toBe(0);
    });
});

describe("playedStepCount", () => {
    it("counts the onsets that have sounded, none before the first", () => {
        expect(playedStepCount([0, 500, 1000], null)).toBe(0);
        expect(playedStepCount([0, 500, 1000], 0)).toBe(1);
        expect(playedStepCount([0, 500, 1000], 700)).toBe(2);
        expect(playedStepCount([0, 500, 1000], 1000)).toBe(3);
    });
});

describe("stepCenterAt", () => {
    it("glides between step centres and clamps at the ends", () => {
        const onsets = [0, 1000];
        const centers = [100, 300];
        expect(stepCenterAt(onsets, centers, -50)).toBe(100);
        expect(stepCenterAt(onsets, centers, 500)).toBe(200);
        expect(stepCenterAt(onsets, centers, 2000)).toBe(300);
        expect(stepCenterAt([], [], 0)).toBe(0);
    });
});

describe("sceneRange on a large piece", () => {
    it("spans a take too long to spread into an argument list", () => {
        // A composition loaded from a large MIDI file runs to six figures of notes.
        const pitches = Array.from({ length: 200_000 }, (_, i) => 21 + (i % 88));
        const range = sceneRange(pitches);
        expect(range.from).toBeLessThanOrEqual(21);
        expect(range.to).toBeGreaterThanOrEqual(108);
    });

    it("still frames an ordinary take", () => {
        const range = sceneRange([60, 62, 64]);
        expect(range.to - range.from).toBeGreaterThanOrEqual(23);
        expect(range.from).toBeLessThanOrEqual(60);
        expect(range.to).toBeGreaterThanOrEqual(64);
    });
});

describe("stepCenterAt with more onsets than centres", () => {
    // The two lists come from different places and can disagree: the onsets are the take's
    // own distinct start times, the centres come from an engraving that quantised those
    // notes to a grid, so a hand-played chord collapses into one step.
    it("holds the last centre instead of jumping to the top of the sheet", () => {
        const onsets = [0, 100, 200, 300, 400];
        const centers = [10, 20, 30];
        const seen = onsets.map((t) => stepCenterAt(onsets, centers, t));
        // Every reading is somewhere on the sheet; none is the y=0 the old fallback gave.
        expect(seen.every((y) => y >= 10)).toBe(true);
        expect(seen).not.toContain(0);
    });

    it("never reads backwards once the centres run out", () => {
        const onsets = [0, 100, 200, 300, 400];
        const centers = [10, 20, 30];
        expect(stepCenterAt(onsets, centers, 350)).toBeGreaterThanOrEqual(
            stepCenterAt(onsets, centers, 250),
        );
    });
});

describe("the keyboard the export draws", () => {
    it("is laid out by the same geometry the app's own keyboard is", () => {
        // Two implementations of piano proportions agreed by coincidence, and a change to
        // the instrument on screen would silently have stopped matching the one in the
        // export. There is one now, and this says so in the only way that stays true: by
        // asking both.
        for (const [from, to] of [
            [60, 72],
            [48, 84],
            [21, 108],
        ] as const) {
            for (const key of sceneKeys(from, to)) {
                const lane = keyLane(key.pitch, from, to);
                expect(lane).not.toBeNull();
                expect(key.x).toBeCloseTo((lane?.leftPct ?? 0) / 100, 10);
                expect(key.width).toBeCloseTo((lane?.widthPct ?? 0) / 100, 10);
                expect(key.black).toBe(!lane?.white);
            }
        }
    });

    it("draws the white keys before the black ones, so the blacks land on top", () => {
        const keys = sceneKeys(60, 72);
        const firstBlack = keys.findIndex((key) => key.black);
        expect(firstBlack).toBeGreaterThan(0);
        expect(keys.slice(0, firstBlack).every((key) => !key.black)).toBe(true);
        expect(keys.slice(firstBlack).every((key) => key.black)).toBe(true);
    });

    it("carries the hand alongside the finger, so both pictures can colour by either", () => {
        const keys = sceneKeys(60, 72);
        const blocks = highwayBlocks(
            [{ pitch: 60, startMs: 0, durationMs: 500, finger: 1, hand: "left" }],
            keys,
            0,
            2000,
        );
        expect(blocks[0]).toMatchObject({ finger: 1, hand: "left" });
    });
});

describe("wrapTitle", () => {
    // A stand-in face: every character is ten wide, so the sums are readable.
    const measure = (text: string) => text.length * 10;

    it("keeps a title that fits on one line", () => {
        expect(wrapTitle(measure, "Gymnopédie No. 1", 400, 400)).toEqual(["Gymnopédie No. 1"]);
    });

    it("breaks at a space, and the second line gets the wider room", () => {
        // 250 on the first row (the wordmark takes the rest), 400 under it.
        const lines = wrapTitle(measure, "Nocturne in E minor, Op. 72 No. 1", 250, 400);
        expect(lines).toHaveLength(2);
        expect(lines.join(" ")).toBe("Nocturne in E minor, Op. 72 No. 1");
        expect(measure(lines[0]!)).toBeLessThanOrEqual(250);
        expect(measure(lines[1]!)).toBeLessThanOrEqual(400);
    });

    it("never splits a word", () => {
        for (const line of wrapTitle(measure, "Toccata and Fugue in D minor", 200, 300)) {
            for (const word of line.split(" ")) {
                expect("Toccata and Fugue in D minor".split(" ")).toContain(word);
            }
        }
    });

    it("keeps a single unbreakable word rather than hyphenating it", () => {
        // Inserting a hyphen into a piece's name invents a spelling it does not have.
        expect(wrapTitle(measure, "Supercalifragilistic", 50, 50)).toEqual([
            "Supercalifragilistic",
        ]);
    });

    it("puts the overflow on the last line when two are not enough", () => {
        const lines = wrapTitle(measure, "one two three four five six seven eight", 60, 60, 2);
        expect(lines).toHaveLength(2);
        // Nothing is dropped: the painter trims what will not fit when it draws.
        expect(lines.join(" ")).toBe("one two three four five six seven eight");
    });

    it("honours a one-line budget", () => {
        expect(wrapTitle(measure, "one two three", 60, 60, 1)).toHaveLength(1);
    });
});

describe("boxInWindow", () => {
    const window = { left: 100, top: 0, width: 200, height: 50 };
    it("keeps a box that overlaps the window, however slightly", () => {
        expect(boxInWindow({ x: 150, y: 10, width: 10, height: 10 }, window)).toBe(true);
        expect(boxInWindow({ x: 90, y: 10, width: 10, height: 10 }, window)).toBe(true);
        expect(boxInWindow({ x: 300, y: 10, width: 10, height: 10 }, window)).toBe(true);
    });
    it("drops a box wholly outside it", () => {
        expect(boxInWindow({ x: 50, y: 10, width: 10, height: 10 }, window)).toBe(false);
        expect(boxInWindow({ x: 150, y: 80, width: 10, height: 10 }, window)).toBe(false);
    });
});

// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { buildSnippet, type Snippet, type SnippetNote } from "./glossaryScore";
import {
    DEMO_BEAT_MS,
    type DemoScore,
    demoDurationMs,
    demoMoments,
    demoNotes,
    demoSnippet,
    demoOf,
    scoreOf,
} from "./theoryDemo";

const C = 60;
const treble = (steps: DemoScore["steps"]): DemoScore => ({ clef: "treble", fifths: 0, steps });

describe("what a demonstration draws", () => {
    it("stacks a chord rather than laying it out in a row", () => {
        // Three notes in one moment are one chord. Written as three separate notes they
        // would fill three beats and be read as an arpeggio.
        const xml = buildSnippet(
            demoSnippet(treble([{ notes: [C, C + 4, C + 7], value: "whole" }])),
        );

        expect(xml.match(/<chord\/>/g)).toHaveLength(2);
        expect(xml.match(/<note>/g)).toHaveLength(3);
        expect(xml.match(/<measure /g)).toHaveLength(1);
    });

    it("writes a chord from the bottom up", () => {
        const notes = demoSnippet(treble([{ notes: [C + 7, C, C + 4], value: "half" }])).notes;

        expect(notes.map((note) => note.octave)).toEqual([4, 4, 4]);
        expect(notes.map((note) => note.step)).toEqual(["C", "E", "G"]);
        expect(notes.map((note) => note.chord)).toEqual([undefined, true, true]);
    });

    it("draws a silence as a rest, taking its time without sounding", () => {
        const score = treble([
            { notes: [C], value: "quarter" },
            { notes: [], value: "quarter" },
            { notes: [C + 4], value: "quarter" },
            { notes: [], value: "quarter" },
        ]);

        expect(demoSnippet(score).notes.filter((note) => note.step === null)).toHaveLength(2);
        // Two notes sound, and the second waits for the rest before it.
        const moments = demoMoments(score, 1000);
        expect(moments).toHaveLength(2);
        expect(moments[1]?.atMs).toBe(2000);
    });

    it("writes a black key out as a sharp rather than dropping it", () => {
        // The lesson about semitones is about the black key. It used to be skipped,
        // because only naturals were drawn — so the page showed one note and played two.
        const notes = demoSnippet(treble([{ notes: [C + 1], value: "half" }])).notes;

        expect(notes).toHaveLength(1);
        expect(notes[0]?.step).toBe("C");
        expect(notes[0]?.alter).toBe(1);
        expect(notes[0]?.accidental).toBe("sharp");
    });
});

describe("what a demonstration sounds", () => {
    it("plays one moment after another, each for its written length", () => {
        const moments = demoMoments(
            treble([
                { notes: [C], value: "whole" },
                { notes: [C + 2], value: "quarter" },
            ]),
            1000,
        );

        expect(moments[0]).toEqual({ notes: [C], atMs: 0, forMs: 4000 });
        expect(moments[1]).toEqual({ notes: [C + 2], atMs: 4000, forMs: 1000 });
    });

    it("sounds one note once, however many times it is written", () => {
        // The lesson about note length wrote seven C's and struck them all at once, which
        // is one note. Seven moments is seven sounds.
        const score = treble(Array.from({ length: 7 }, () => ({ notes: [C], value: "quarter" })));

        expect(demoMoments(score)).toHaveLength(7);
        expect(new Set(demoMoments(score).map((one) => one.atMs)).size).toBe(7);
    });

    it("runs as long as what is written", () => {
        expect(demoDurationMs(treble([{ notes: [C], value: "whole" }]), 1000)).toBe(4000);
        expect(demoDurationMs(treble([{ notes: [], value: "half" }]), 1000)).toBe(2000);
        expect(DEMO_BEAT_MS).toBeGreaterThan(0);
    });
});

describe("what a demonstration lights", () => {
    it("names every note it ever sounds, in order, once each", () => {
        const score = treble([
            { notes: [C + 7, C], value: "half" },
            { notes: [C], value: "half" },
        ]);

        expect(demoNotes(score)).toEqual([C, C + 7]);
    });

    it("lights nothing for a demonstration of nothing", () => {
        expect(demoNotes(treble([]))).toEqual([]);
        expect(demoMoments(treble([{ notes: [], value: "half" }]))).toEqual([]);
    });
});

describe("a demonstration built from bare pitches", () => {
    it("sounds a group together, or one at a time when spread", () => {
        expect(demoMoments(scoreOf([[C, C + 4]]))).toHaveLength(1);
        expect(demoMoments(scoreOf([[C, C + 4]], { spread: true }))).toHaveLength(2);
    });

    it("keeps groups in the order they were given", () => {
        const moments = demoMoments(scoreOf([[C], [C + 12]]));

        expect(moments.map((one) => one.notes)).toEqual([[C], [C + 12]]);
        expect(moments[1]?.atMs).toBeGreaterThan(0);
    });
});

describe("reading a glossary entry as a keyboard demonstration", () => {
    const snippet = (notes: SnippetNote[]): Snippet => ({
        clef: "treble",
        fifths: 0,
        beatsPerBar: 4,
        notes,
    });

    it("puts each note under a key, in order", () => {
        const demo = demoOf(
            snippet([
                { step: "C", octave: 4, value: "quarter" },
                { step: "E", octave: 4, value: "quarter" },
            ]),
        );
        expect(demo.steps.map((step) => step.notes)).toEqual([[60], [64]]);
    });

    it("keeps a chord a chord", () => {
        // `chord` means "sounds WITH the note before it", exactly as MusicXML means it.
        // Read as a sequence, an interval would come out as a melody.
        const demo = demoOf(
            snippet([
                { step: "C", octave: 4, value: "half" },
                { step: "E", octave: 4, value: "half", chord: true },
                { step: "G", octave: 4, value: "half", chord: true },
            ]),
        );
        expect(demo.steps).toHaveLength(1);
        expect(demo.steps[0]?.notes).toEqual([60, 64, 67]);
    });

    it("carries the dot, which for one entry is the whole subject", () => {
        const demo = demoOf(snippet([{ step: "C", octave: 5, value: "half", dotted: true }]));
        expect(demo.steps[0]?.dotted).toBe(true);
    });

    it("gives a rest no key to press but still its place in time", () => {
        const demo = demoOf(
            snippet([
                { step: "C", octave: 4, value: "quarter" },
                { step: null, value: "quarter" },
            ]),
        );
        expect(demo.steps.map((step) => step.notes)).toEqual([[60], []]);
    });

    it("reads a black key the way the key signature spells it", () => {
        const sharps: Snippet = {
            clef: "treble",
            fifths: 1,
            beatsPerBar: 4,
            notes: [{ step: "F", octave: 4, value: "quarter" }],
        };
        expect(demoOf(sharps).steps[0]?.notes).toEqual([66]);
    });

    it("keeps the clef and the key, which the keyboard draws around", () => {
        const demo = demoOf({ clef: "bass", fifths: -2, beatsPerBar: 3, notes: [] });
        expect(demo.clef).toBe("bass");
        expect(demo.fifths).toBe(-2);
    });
});

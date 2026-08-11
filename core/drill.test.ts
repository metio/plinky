// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { DEFAULT_DRILL, type DrillOptions, generateDrill, pitchPool, spell } from "./drill";
import { seededRandom } from "./random";

// A deterministic rng: cycles the given values, so a test picks exactly which
// draws happen rather than hoping a seed lands somewhere useful.
function rngOf(...values: number[]): () => number {
    let at = 0;
    return () => values[at++ % values.length] ?? 0;
}

const options = (over: Partial<DrillOptions> = {}): DrillOptions => ({
    ...DEFAULT_DRILL,
    ...over,
});

function pitchesIn(xml: string): string[] {
    return [...xml.matchAll(/<step>(\w)<\/step>(?:<alter>(-?\d)<\/alter>)?<octave>(\d)<\/octave>/g)].map(
        (match) => `${match[1]}${match[2] === "1" ? "#" : match[2] === "-1" ? "b" : ""}${match[3]}`,
    );
}

describe("spell", () => {
    it("writes a scale tone plain and lets the signature do the work", () => {
        // F# in G major is the signature's sharp, not an accidental on the note.
        expect(spell(66, 1)).toEqual({ step: "F", octave: 4, alter: 1 });
        expect(spell(60, 0)).toEqual({ step: "C", octave: 4, alter: 0 });
        // Bb in F major, likewise from the signature.
        expect(spell(70, -1)).toEqual({ step: "B", octave: 4, alter: -1 });
    });

    it("leans the way the key does for a note outside it", () => {
        // C# in C major spells as a sharp...
        expect(spell(61, 0)).toEqual({ step: "C", octave: 4, alter: 1 });
        // ...and as a flat in a flat key, where the reader is already reading flats.
        expect(spell(61, -2)).toEqual({ step: "D", octave: 4, alter: -1 });
    });

    it("names the octave MIDI does", () => {
        expect(spell(60, 0).octave).toBe(4);
        expect(spell(72, 0).octave).toBe(5);
        expect(spell(21, 0)).toEqual({ step: "A", octave: 0, alter: 0 });
    });

    it("spells every pitch class in every signature", () => {
        for (let fifths = -7; fifths <= 7; fifths++) {
            for (let midi = 60; midi < 72; midi++) {
                const { step, octave, alter } = spell(midi, fifths);
                expect(LETTER_SEMITONE[step]).toBeDefined();
                // The spelling must actually sound the note it was asked for.
                const sounded = (octave + 1) * 12 + (LETTER_SEMITONE[step] ?? 0) + alter;
                expect(sounded).toBe(midi);
            }
        }
    });
});

const LETTER_SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

describe("pitchPool", () => {
    it("draws one octave of a major scale from the key alone", () => {
        const pool = pitchPool(options({ low: 60, high: 71 }));

        // C major over C4..B4: the white keys.
        expect(pool).toEqual([60, 62, 64, 65, 67, 69, 71]);
    });

    it("follows the signature rather than the letters", () => {
        // G major swaps F natural for F#.
        expect(pitchPool(options({ low: 60, high: 71, fifths: 1 }))).toEqual([
            60, 62, 64, 66, 67, 69, 71,
        ]);
    });

    it("takes all twelve when chromatic", () => {
        expect(pitchPool(options({ low: 60, high: 71, chromatic: true }))).toHaveLength(12);
    });

    it("never strays outside the playable keyboard", () => {
        const pool = pitchPool(options({ low: -50, high: 500, chromatic: true }));

        expect(pool[0]).toBe(21);
        expect(pool[pool.length - 1]).toBe(108);
    });

    it("comes back empty for a range holding nothing of the key", () => {
        // C4 to C#4 in C major: the only note between them is not in the key.
        expect(pitchPool(options({ low: 61, high: 61 }))).toEqual([]);
    });
});

describe("generateDrill", () => {
    it("fills every bar to exactly a barful, whatever the rhythm", () => {
        for (const rhythm of ["quarters", "eighths", "varied"] as const) {
            const xml = generateDrill(
                options({ bars: 3, beatsPerBar: 4, rhythm }),
                rngOf(0.05, 0.3, 0.9, 0.5),
            );
            const durations = [...xml.matchAll(/<duration>(\d+)<\/duration>/g)].map((m) =>
                Number(m[1]),
            );
            // 3 bars × 4 beats × 2 divisions.
            expect(durations.reduce((sum, d) => sum + d, 0)).toBe(24);
        }
    });

    it("draws only from the key and range it was given", () => {
        const xml = generateDrill(options({ bars: 4, low: 60, high: 72, fifths: 1 }), Math.random);

        for (const pitch of pitchesIn(xml)) {
            // G major over C4..C5 — every note white except F#, nothing flat.
            expect(pitch).not.toContain("b");
            expect(["C4", "D4", "E4", "F#4", "G4", "A4", "B4", "C5"]).toContain(pitch);
        }
    });

    it("stacks a chord under one duration rather than sounding notes in turn", () => {
        const xml = generateDrill(
            options({ bars: 1, beatsPerBar: 2, notesPerColumn: 3, low: 60, high: 84 }),
            rngOf(0.1, 0.4, 0.7),
        );

        // Two beats of three-note chords: six notes, four of them marked <chord/>,
        // and the bar still lasts two beats.
        expect((xml.match(/<chord\/>/g) ?? []).length).toBe(4);
        const durations = [...xml.matchAll(/<duration>(\d+)<\/duration>/g)].map((m) => Number(m[1]));
        expect(durations).toHaveLength(6);
    });

    it("gives a two-hand drill a bass staff drawn below the treble", () => {
        const xml = generateDrill(options({ bars: 2, hands: 2, low: 48, high: 84 }), Math.random);

        expect(xml).toContain("<staff>2</staff>");
        const staves = [...xml.matchAll(/<octave>(\d)<\/octave>[\s\S]*?<staff>(\d)<\/staff>/g)];
        const trebleLow = Math.min(
            ...staves.filter((s) => s[2] === "1").map((s) => Number(s[1])),
        );
        const bassHigh = Math.max(...staves.filter((s) => s[2] === "2").map((s) => Number(s[1])));
        // The hands read their own halves rather than crossing over each other.
        expect(trebleLow).toBeGreaterThanOrEqual(bassHigh);
    });

    it("keeps consecutive notes within the leap limit", () => {
        const xml = generateDrill(
            options({ bars: 8, low: 48, high: 84, maxLeap: 4, chromatic: true }),
            Math.random,
        );
        const midis = pitchesIn(xml).map(toMidi);

        for (let i = 1; i < midis.length; i++) {
            expect(Math.abs((midis[i] ?? 0) - (midis[i - 1] ?? 0))).toBeLessThanOrEqual(4);
        }
    });

    it("moves less as smoothness rises", () => {
        const wander = (smoothness: number) => {
            const xml = generateDrill(
                options({ bars: 16, low: 48, high: 84, smoothness, chromatic: true }),
                seeded(7),
            );
            const midis = pitchesIn(xml).map(toMidi);
            let total = 0;
            for (let i = 1; i < midis.length; i++) {
                total += Math.abs((midis[i] ?? 0) - (midis[i - 1] ?? 0));
            }
            return total / Math.max(1, midis.length - 1);
        };

        // Not a guarantee for any one pair of notes — the drill keeps the closest of
        // N draws, so the average step shrinks while any single leap may not.
        expect(wander(6)).toBeLessThan(wander(0));
    });

    it("still produces a playable drill when the range cannot satisfy the options", () => {
        // One note in the pool, asked for four-note chords with a tight leap limit.
        const xml = generateDrill(
            options({ bars: 1, low: 60, high: 60, notesPerColumn: 4, maxLeap: 1 }),
            Math.random,
        );

        expect(xml).toContain("<step>C</step>");
        expect(pitchesIn(xml).every((pitch) => pitch === "C4")).toBe(true);
    });

    it("survives an inverted range by reading it as the span it names", () => {
        const xml = generateDrill(options({ bars: 1, low: 72, high: 60 }), Math.random);

        expect(pitchesIn(xml).length).toBeGreaterThan(0);
    });
});

function toMidi(pitch: string): number {
    const letter = pitch[0] ?? "C";
    const sharp = pitch.includes("#") ? 1 : pitch.includes("b") ? -1 : 0;
    const octave = Number(pitch[pitch.length - 1]);
    return (octave + 1) * 12 + (LETTER_SEMITONE[letter] ?? 0) + sharp;
}

// A small deterministic generator, so a distribution-shaped assertion runs on the
// same numbers every time rather than flaking on an unlucky Math.random.
function seeded(seed: number): () => number {
    let state = seed;
    return () => {
        state = (state * 1664525 + 1013904223) % 4294967296;
        return state / 4294967296;
    };
}

describe("options no reader would choose", () => {
    // The panel bounds every knob, so none of this arrives through the UI. It is here
    // because the generator is also called from code — the daily challenge, the
    // placement ladder — and a drill that throws or writes a pitch off the keyboard
    // would take the page down rather than draw a bad bar.
    const SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    const midisIn = (xml: string): number[] =>
        [
            ...xml.matchAll(
                /<step>([A-G])<\/step>(?:<alter>(-?\d+)<\/alter>)?<octave>(-?\d+)<\/octave>/g,
            ),
        ].map((m) => (Number(m[3]) + 1) * 12 + SEMI[m[1]!]! + Number(m[2] ?? 0));

    it.each([
        ["an inverted range", { low: 90, high: 40 }],
        ["a range holding no note of the key", { low: 61, high: 61, fifths: 0 }],
        ["a range of one note", { low: 60, high: 60 }],
        ["no bars", { bars: 0 }],
        ["no beats to the bar", { beatsPerBar: 0 }],
        ["a fractional meter", { beatsPerBar: 3.5 }],
        ["a key signature past the circle of fifths", { fifths: 30 }],
        ["more notes per column than fingers", { notesPerColumn: 40 }],
        ["two hands on a one-note range", { hands: 2 as const, low: 60, high: 60 }],
        ["a range off the bottom of the piano", { low: -50, high: -10 }],
        ["a range off the top", { low: 200, high: 300 }],
    ])("draws something playable for %s", (_case, patch) => {
        const xml = generateDrill({ ...DEFAULT_DRILL, ...patch }, seededRandom(7));
        expect(xml).toContain("score-partwise");
        const off = midisIn(xml).filter((n) => !Number.isFinite(n) || n < 21 || n > 108);
        expect(off.slice(0, 3)).toEqual([]);
    });

    it("keeps the pool on the keyboard however wide the range asked", () => {
        const pool = pitchPool({ ...DEFAULT_DRILL, low: -100, high: 500, chromatic: true });
        expect(Math.min(...pool)).toBeGreaterThanOrEqual(21);
        expect(Math.max(...pool)).toBeLessThanOrEqual(108);
    });
});

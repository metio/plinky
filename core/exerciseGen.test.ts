// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
    buildExerciseId,
    EXERCISE_TILES,
    type ExerciseConfig,
    exerciseTitle,
    exerciseTitleParts,
    generateExercise,
    type Hands,
    type Interval,
    parseExerciseId,
} from "./exerciseGen";
import { songId } from "./songId";

describe("exercise ids", () => {
    it("round-trips canonical base ids unchanged", () => {
        for (const id of [
            "scale-c-major",
            "scale-a-minor",
            "scale-a-harmonic-minor",
            "scale-csharp-minor",
            "scale-c-chromatic",
            "arpeggio-c-major",
            "arpeggio-c-dom7",
        ]) {
            const config = parseExerciseId(id);
            expect(config, id).not.toBeNull();
            expect(buildExerciseId(config!)).toBe(id);
        }
    });

    it("encodes and parses an inversion form variant", () => {
        const config = {
            type: "major-arpeggio" as const,
            key: "c",
            octaves: 2 as const,
            hands: "both" as const,
            inversion: 1 as const,
            interval: "single" as const,
        };
        const id = buildExerciseId(config);
        expect(id).toBe("arpeggio-c-major.2bi1");
        expect(parseExerciseId(id)).toEqual(config);
    });

    it("encodes and parses an interval (thirds/sixths) form variant", () => {
        const config = {
            type: "major-scale" as const,
            key: "c",
            octaves: 2 as const,
            hands: "right" as const,
            inversion: 0 as const,
            interval: "thirds" as const,
        };
        const id = buildExerciseId(config);
        expect(id).toBe("scale-c-major.2rt");
        expect(parseExerciseId(id)).toEqual(config);
    });

    it("rejects non-exercise ids", () => {
        expect(parseExerciseId("twinkle-twinkle")).toBeNull();
        expect(parseExerciseId("QmAbc123")).toBeNull();
    });

    it("has 97 tiles that all round-trip", () => {
        expect(EXERCISE_TILES).toHaveLength(97);
        for (const tile of EXERCISE_TILES) {
            expect(parseExerciseId(buildExerciseId(tile))).toEqual(tile);
        }
    });

    it("offers exactly one chromatic-scale tile (the canonical C-rooted run)", () => {
        const chromatic = EXERCISE_TILES.filter((tile) => tile.type === "chromatic-scale");
        expect(chromatic).toHaveLength(1);
        expect(chromatic[0]!.key).toBe("c");
    });

    it("gives every tile distinct content, so no two share a fingerprint id", () => {
        // The manifest keys entries by songId(xml), a content fingerprint. Two tiles
        // generating note-identical MusicXML would collapse to one id and surface as
        // duplicate rows / duplicate React keys downstream.
        const ids = new Map<string, string>();
        for (const tile of EXERCISE_TILES) {
            const id = songId(generateExercise(tile));
            expect(ids.get(id), `${buildExerciseId(tile)} vs ${ids.get(id)}`).toBeUndefined();
            ids.set(id, buildExerciseId(tile));
        }
    });
});

// Pitches in document order from a generated single-hand exercise, as MIDI-ish
// numbers, read straight from the MusicXML so no DOM is needed.
function pitchSequence(xml: string): number[] {
    const STEP: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    const out: number[] = [];
    for (const match of xml.matchAll(/<pitch>(.*?)<\/pitch>/gs)) {
        const block = match[1]!;
        const step = block.match(/<step>([A-G])<\/step>/)![1]!;
        const alter = Number(block.match(/<alter>(-?\d+)<\/alter>/)?.[1] ?? 0);
        const octave = Number(block.match(/<octave>(\d+)<\/octave>/)![1]!);
        out.push((octave + 1) * 12 + STEP[step]! + alter);
    }
    return out;
}

describe("arpeggio inversions", () => {
    for (const octaves of [1, 2] as const) {
        for (const inversion of [1, 2] as const) {
            it(`ascends without a duplicate note (${octaves}-octave inversion ${inversion})`, () => {
                const xml = generateExercise({
                    type: "major-arpeggio",
                    key: "c",
                    octaves,
                    hands: "right",
                    inversion,
                    interval: "single",
                });
                const pitches = pitchSequence(xml);
                // No note repeats back-to-back — the old rotation duplicated the tonic.
                for (let i = 1; i < pitches.length; i++) {
                    expect(pitches[i]).not.toBe(pitches[i - 1]);
                }
                // It's a single mountain: one apex, climbed strictly, then descended.
                // The old rotation put the closing tonic mid-run, so the top note
                // recurred and the line dipped before the real turn.
                const top = Math.max(...pitches);
                expect(pitches.filter((p) => p === top)).toHaveLength(1);
                const apex = pitches.indexOf(top);
                for (let i = 1; i <= apex; i++) {
                    expect(pitches[i]!).toBeGreaterThan(pitches[i - 1]!);
                }
                // An inversion starts above the tonic, on a higher chord tone.
                expect(pitches[0]!).toBeGreaterThan(60);
            });
        }
    }
});

describe("generateExercise", () => {
    it("generates valid MusicXML for the canonical form", () => {
        const xml = generateExercise(parseExerciseId("scale-c-major")!);
        expect(xml).toContain("score-partwise");
        expect(xml).toContain("<step>C</step>");
    });

    it("spells a dominant 7th with a flat 7th (C7 has B♭)", () => {
        const xml = generateExercise(parseExerciseId("arpeggio-c-dom7")!);
        expect(xml).toContain("<step>B</step><alter>-1</alter>");
    });

    it("spells a diminished 7th with a double-flat (C°7 has B𝄫)", () => {
        const xml = generateExercise(parseExerciseId("arpeggio-c-dim7")!);
        expect(xml).toContain("<step>B</step><alter>-2</alter>");
        expect(xml).toContain("<step>E</step><alter>-1</alter>");
    });

    it("raises the 7th in harmonic minor (A harmonic minor has G♯)", () => {
        const xml = generateExercise(parseExerciseId("scale-a-harmonic-minor")!);
        expect(xml).toContain("<step>G</step><alter>1</alter>");
    });

    it("emits two parts for both hands", () => {
        const both = generateExercise({
            type: "major-scale",
            key: "c",
            octaves: 1,
            hands: "both",
            inversion: 0,
            interval: "single",
        });
        expect((both.match(/<part id=/g) ?? []).length).toBe(2);
    });

    it("mirrors the hands in contrary motion, the left descending from the tonic", () => {
        const contrary = generateExercise({
            type: "major-scale",
            key: "c",
            octaves: 1,
            hands: "contrary",
            inversion: 0,
            interval: "single",
        });
        const parallel = generateExercise({
            type: "major-scale",
            key: "c",
            octaves: 1,
            hands: "both",
            inversion: 0,
            interval: "single",
        });
        // Two staves, and the mirrored left hand makes it differ from parallel both-hands.
        expect((contrary.match(/<part id=/g) ?? []).length).toBe(2);
        expect(contrary).not.toBe(parallel);
    });

    it("falls back to both hands for an arpeggio in contrary motion (contrary is scale-only)", () => {
        // An arpeggio has no contrary form, so it must render as both hands in parallel
        // rather than doubling the treble line onto the bass staff — and say so.
        const base = {
            type: "major-arpeggio",
            key: "c",
            octaves: 1,
            inversion: 0,
            interval: "single",
        } as const;
        expect(generateExercise({ ...base, hands: "contrary" })).toBe(
            generateExercise({ ...base, hands: "both" }),
        );
        expect(exerciseTitle({ ...base, hands: "contrary" })).toContain("both hands");
        expect(exerciseTitle({ ...base, hands: "contrary" })).not.toContain("contrary");
    });

    it("sounds two notes per position in a scale in thirds (C+E)", () => {
        const xml = generateExercise(parseExerciseId("scale-c-major.1rt")!);
        // The double stop prints the upper note as a <chord/>.
        expect(xml).toContain("<chord/>");
        expect(xml).toContain("<step>E</step>");
    });
});

describe("an id names the exercise, not the route taken to it", () => {
    const scale: ExerciseConfig = {
        type: "major-scale",
        key: "c",
        octaves: 1,
        hands: "right",
        inversion: 0,
        interval: "single",
    };

    it("drops a double stop that contrary motion has no version of", () => {
        // Walking the form — choose "in thirds", then "contrary motion" — leaves the
        // interval set on a config that no longer has a use for it.
        const viaThirds = { ...scale, interval: "thirds" as const, hands: "contrary" as const };
        const direct = { ...scale, hands: "contrary" as const };
        expect(buildExerciseId(viaThirds)).toBe(buildExerciseId(direct));
        expect(generateExercise(viaThirds)).toBe(generateExercise(direct));
    });

    it("does not advertise a form the notes do not contain", () => {
        const viaThirds = { ...scale, interval: "thirds" as const, hands: "contrary" as const };
        expect(exerciseTitle(viaThirds)).not.toContain("thirds");
        expect(exerciseTitle(viaThirds)).toBe(exerciseTitle({ ...scale, hands: "contrary" }));
    });

    it("drops an inversion a scale has no version of", () => {
        const inverted = { ...scale, inversion: 2 as const };
        expect(buildExerciseId(inverted)).toBe(buildExerciseId(scale));
        expect(exerciseTitle(inverted)).not.toContain("inversion");
    });

    it("drops contrary motion an arpeggio has no version of", () => {
        const arpeggio: ExerciseConfig = { ...scale, type: "major-arpeggio" };
        const contrary = { ...arpeggio, hands: "contrary" as const };
        expect(buildExerciseId(contrary)).toBe(buildExerciseId({ ...arpeggio, hands: "both" }));
    });

    it("keeps the dials that do apply", () => {
        expect(buildExerciseId({ ...scale, interval: "thirds" })).toBe("scale-c-major.1rt");
        expect(buildExerciseId({ ...scale, type: "major-arpeggio", inversion: 2 })).toBe(
            "arpeggio-c-major.1ri2",
        );
        expect(buildExerciseId({ ...scale, hands: "contrary" })).toBe("scale-c-major.1c");
    });

    it("resolves a hand-written id to the nearest real exercise", () => {
        // An inversion of a scale: playable, but not a form this exercise has.
        const parsed = parseExerciseId("scale-c-major.1ri1");
        expect(parsed?.inversion).toBe(0);
        expect(buildExerciseId(parsed!)).toBe("scale-c-major");
    });

    it("gives every distinct score a distinct id", () => {
        const byId = new Map<string, string>();
        const collisions: string[] = [];
        for (const tile of EXERCISE_TILES) {
            for (const octaves of [1, 2] as const) {
                for (const hands of ["right", "left", "both", "contrary"] as Hands[]) {
                    for (const inversion of [0, 1, 2] as const) {
                        for (const interval of ["single", "thirds", "sixths"] as Interval[]) {
                            const config = { ...tile, octaves, hands, inversion, interval };
                            const id = buildExerciseId(config);
                            const xml = generateExercise(config);
                            const seen = byId.get(id);
                            if (seen === undefined) {
                                byId.set(id, xml);
                            } else if (seen !== xml) {
                                collisions.push(id);
                            }
                        }
                    }
                }
            }
        }
        expect([...new Set(collisions)].slice(0, 5)).toEqual([]);
    });

    it("gives every distinct id a distinct score", () => {
        const byScore = new Map<string, string>();
        const duplicates: string[] = [];
        for (const tile of EXERCISE_TILES) {
            for (const hands of ["right", "left", "both", "contrary"] as Hands[]) {
                for (const inversion of [0, 1, 2] as const) {
                    for (const interval of ["single", "thirds", "sixths"] as Interval[]) {
                        const config = { ...tile, octaves: 1 as const, hands, inversion, interval };
                        const id = buildExerciseId(config);
                        const xml = generateExercise(config);
                        const seen = byScore.get(xml);
                        if (seen === undefined) {
                            byScore.set(xml, id);
                        } else if (seen !== id) {
                            duplicates.push(`${seen} === ${id}`);
                        }
                    }
                }
            }
        }
        expect([...new Set(duplicates)].slice(0, 5)).toEqual([]);
    });
});

describe("exerciseTitleParts", () => {
    const base: ExerciseConfig = {
        type: "major-scale",
        key: "c",
        octaves: 1,
        hands: "right",
        inversion: 0,
        interval: "single",
    };

    it("names the key as a musician writes it, and leaves the words to the caller", () => {
        // The parts, not a sentence: "C major scale" has a different shape in every
        // language, so nothing here may assume English word order.
        expect(exerciseTitleParts({ ...base, key: "eflat" })).toEqual({
            key: "E\u266d",
            type: "major-scale",
            forms: [],
        });
        expect(exerciseTitleParts({ ...base, key: "fsharp" }).key).toBe("F\u266f");
    });

    it("says only what makes this one different from the plain form", () => {
        expect(exerciseTitleParts({ ...base, octaves: 2, hands: "both" }).forms).toEqual([
            "two-octaves",
            "both-hands",
        ]);
        expect(exerciseTitleParts({ ...base, interval: "thirds" }).forms).toEqual(["thirds"]);
    });

    it("never claims a form the notes do not have", () => {
        // Normalisation drops an inversion from a scale and contrary motion from an
        // arpeggio; a title that kept them would describe a piece nobody is playing.
        expect(exerciseTitleParts({ ...base, inversion: 2 }).forms).toEqual([]);
        expect(
            exerciseTitleParts({ ...base, type: "major-arpeggio", hands: "contrary" }).forms,
        ).toEqual(["both-hands"]);
    });

    it("orders the forms the same way whatever the exercise", () => {
        // The list reads as one phrase, so its order has to be fixed rather than falling
        // out of which branches happened to run.
        expect(
            exerciseTitleParts({
                ...base,
                interval: "sixths",
                octaves: 2,
                hands: "left",
            }).forms,
        ).toEqual(["sixths", "two-octaves", "left-hand"]);
    });

    it("agrees with the English title the score itself carries", () => {
        const config: ExerciseConfig = { ...base, type: "dim7-arpeggio", inversion: 1 };
        const { key, forms } = exerciseTitleParts(config);
        const title = exerciseTitle(config);
        expect(title.startsWith(key)).toBe(true);
        expect(forms).toEqual(["inversion-1"]);
        expect(title).toContain("1st inversion");
    });

    it("has a name for every kind of exercise the tiles offer", () => {
        for (const tile of EXERCISE_TILES) {
            const { type } = exerciseTitleParts(tile);
            expect(type).toBe(tile.type);
            expect(exerciseTitle(tile).length).toBeGreaterThan(0);
        }
    });
});

describe("contrary motion", () => {
    // Both hands play THE SAME SCALE in opposite directions. Reading the notes back out of
    // the score is the only way to see that: a wrong scale in one hand is a wrong sound,
    // not an error, so nothing else in the build would have said a word.
    const midisOf = (xml: string, part: string) => {
        const chunk = xml.split(`<part id="${part}"`)[1]?.split("</part>")[0] ?? "";
        const BASE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
        return [
            ...chunk.matchAll(
                /<step>(\w)<\/step>\s*(?:<alter>(-?\d+)<\/alter>\s*)?<octave>(\d+)<\/octave>/g,
            ),
        ].map((m) => (Number(m[3]) + 1) * 12 + BASE[m[1]!]! + Number(m[2] ?? 0));
    };
    const hands = (type: Parameters<typeof generateExercise>[0]["type"]) => {
        const xml = generateExercise({
            type,
            key: "c",
            octaves: 1,
            hands: "contrary",
            inversion: 0,
            interval: "single",
        });
        return { right: midisOf(xml, "P1"), left: midisOf(xml, "P2") };
    };

    it("gives both hands the same number of notes, whatever the scale", () => {
        // The defect this pins: the descending hand was always a plain diatonic scale, so
        // a chromatic exercise put 25 notes against 15 and the hands never met.
        for (const type of [
            "major-scale",
            "natural-minor-scale",
            "harmonic-minor-scale",
            "melodic-minor-scale",
            "chromatic-scale",
        ] as const) {
            const { right, left } = hands(type);
            expect(`${type}: ${left.length}`).toBe(`${type}: ${right.length}`);
        }
    });

    it("descends by semitone in a chromatic exercise", () => {
        expect(hands("chromatic-scale").left.slice(0, 5)).toEqual([60, 59, 58, 57, 56]);
    });

    it("keeps the raised seventh going down in harmonic minor", () => {
        // What makes it harmonic: B natural in both directions, not the B flat a plain
        // diatonic descent produces.
        expect(hands("harmonic-minor-scale").left.slice(0, 3)).toEqual([60, 59, 56]);
    });

    it("descends natural in melodic minor, and rises raised", () => {
        const { left } = hands("melodic-minor-scale");
        expect(left.slice(0, 3)).toEqual([60, 58, 56]);
        // Coming back up, the sixth and seventh are raised: A natural and B natural, not
        // the A flat and B flat the descent used.
        expect(left.slice(-3)).toEqual([57, 59, 60]);
    });

    it("mirrors the major scale, which is the case that always worked", () => {
        expect(hands("major-scale").left.slice(0, 4)).toEqual([60, 59, 57, 55]);
    });
});

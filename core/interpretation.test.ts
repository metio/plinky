// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
    assumedPhraseWeight,
    interpretedWeight,
    metricalWeight,
    phraseWeight,
    placeInBar,
} from "./interpretation";
import type { XmlBar } from "./musicxmlTimeline";

const fourFour: XmlBar[] = [
    { from: 0, beats: 4, beatType: 4 },
    { from: 1, beats: 4, beatType: 4 },
];
const threeFour: XmlBar[] = [{ from: 0, beats: 3, beatType: 4 }];
const sixEight: XmlBar[] = [{ from: 0, beats: 6, beatType: 8 }];

describe("where a note sits in its bar", () => {
    it("counts beats from the barline", () => {
        expect(placeInBar(fourFour, 0)).toMatchObject({ beat: 0, beats: 4 });
        expect(placeInBar(fourFour, 0.25)).toMatchObject({ beat: 1, beats: 4 });
        expect(placeInBar(fourFour, 0.75)).toMatchObject({ beat: 3, beats: 4 });
    });

    it("counts from the bar the note is actually in", () => {
        expect(placeInBar(fourFour, 1)).toMatchObject({ beat: 0, beats: 4 });
        expect(placeInBar(fourFour, 1.5)).toMatchObject({ beat: 2, beats: 4 });
    });

    it("keeps counting past the last bar the file declares", () => {
        // A metre stands until another is written, and a repeat brings the walk back over
        // bars it has already passed — neither should stop the beat being knowable.
        expect(placeInBar(threeFour, 0.75)).toMatchObject({ beat: 0, beats: 3 });
        expect(placeInBar(threeFour, 1.0)).toMatchObject({ beat: 1, beats: 3 });
    });

    it("says nothing for a score that states no metre", () => {
        expect(placeInBar([], 0)).toBeNull();
        expect(placeInBar([{ from: 0, beats: 0, beatType: 0 }], 0)).toBeNull();
    });

    it("counts a compound metre in its own beats", () => {
        expect(placeInBar(sixEight, 0)).toMatchObject({ beat: 0, beats: 6 });
        expect(placeInBar(sixEight, 0.375)).toMatchObject({ beat: 3, beats: 6 });
    });
});

describe("the weight a bar gives its beats", () => {
    it("gives the downbeat the most, and never more than the score asks", () => {
        expect(metricalWeight(fourFour, 0)).toBe(1);
        expect(metricalWeight(fourFour, 1)).toBe(1);
    });

    it("orders the beats of a four-four bar the way a bar is heard", () => {
        const [one, two, three, four] = [0, 0.25, 0.5, 0.75].map((at) =>
            metricalWeight(fourFour, at),
        );
        // One strongest, three next, two and four weakest — which is what makes four-four
        // sound unlike three-four rather than merely last longer.
        expect(one).toBeGreaterThan(three as number);
        expect(three).toBeGreaterThan(two as number);
        expect(two).toBe(four);
    });

    it("gives an odd bar no secondary stress to land on", () => {
        const [one, two, three] = [0, 0.25, 0.5].map((at) => metricalWeight(threeFour, at));
        expect(one).toBeGreaterThan(two as number);
        expect(two).toBe(three);
    });

    it("leans on the halfway beat of a compound bar", () => {
        // Six-eight is two groups of three; the fourth quaver begins the second.
        expect(metricalWeight(sixEight, 0.375)).toBeGreaterThan(
            metricalWeight(sixEight, 0.25) as number,
        );
    });

    it("gives a note between beats the least", () => {
        expect(metricalWeight(fourFour, 0.125)).toBeLessThan(
            metricalWeight(fourFour, 0.25) as number,
        );
    });

    it("stresses nothing where the score states no metre", () => {
        expect(metricalWeight([], 0.3)).toBe(1);
    });
});

describe("the shape a phrase is given", () => {
    const arch = [{ from: 0, to: 1 }];

    it("lets a slurred phrase settle rather than stopping dead", () => {
        expect(phraseWeight(arch, 0)).toBe(1);
        expect(phraseWeight(arch, 1)).toBeLessThan(1);
        expect(phraseWeight(arch, 0.5)).toBeLessThan(phraseWeight(arch, 0) as number);
        expect(phraseWeight(arch, 0.5)).toBeGreaterThan(phraseWeight(arch, 1) as number);
    });

    it("invents no phrase where the score drew none", () => {
        expect(phraseWeight([], 0.5)).toBe(1);
        expect(phraseWeight(arch, 2)).toBe(1);
    });

    it("ignores an arch of no length rather than dividing by it", () => {
        expect(phraseWeight([{ from: 1, to: 1 }], 1)).toBe(1);
    });
});

describe("what a note is actually played at", () => {
    it("never exceeds what the page asks for", () => {
        for (const at of [0, 0.125, 0.25, 0.5, 0.75, 1, 1.5]) {
            expect(interpretedWeight(fourFour, [{ from: 0, to: 2 }], at)).toBeLessThanOrEqual(1);
        }
    });

    it("never lets a note vanish under the one before it", () => {
        for (const at of [0.125, 0.375, 0.875]) {
            expect(interpretedWeight(fourFour, [{ from: 0, to: 2 }], at)).toBeGreaterThanOrEqual(
                0.7,
            );
        }
    });

    it("plays a score with no metre and no arches exactly as written", () => {
        // Interpretation is something added to what the page says, never a replacement for
        // it: with nothing to read, nothing is changed.
        expect(interpretedWeight([], [], 0.3)).toBe(1);
    });

    it("shapes a bar even where the score marks no dynamics at all", () => {
        // The case this exists for: a teaching study prints nothing, and played flat it is
        // a metronome with pitches.
        const weights = [0, 0.125, 0.25, 0.5, 0.75].map((at) =>
            interpretedWeight(fourFour, [], at),
        );
        expect(new Set(weights).size).toBeGreaterThan(2);
    });
});

describe("a phrase nobody wrote down", () => {
    // Four bars of common time, which is what 38% of the catalogue looks like: bars, notes,
    // and not one other mark.
    const bars = Array.from({ length: 8 }, (_, index) => ({
        from: index,
        beats: 4,
        beatType: 4,
    }));

    it("arches across a group of bars instead of holding one level", () => {
        // Played at one level, four bars are identical to the last four and the result is
        // unmistakably a machine. The arch is what gives the line somewhere to go.
        const start = assumedPhraseWeight(bars, 0);
        const middle = assumedPhraseWeight(bars, 2);
        const end = assumedPhraseWeight(bars, 3.9);
        expect(middle).toBeGreaterThan(start);
        expect(middle).toBeGreaterThan(end);
    });

    it("starts each group afresh", () => {
        // A phrase is a sentence, not a slope across the whole piece.
        expect(assumedPhraseWeight(bars, 4)).toBeCloseTo(assumedPhraseWeight(bars, 0));
        expect(assumedPhraseWeight(bars, 6)).toBeCloseTo(assumedPhraseWeight(bars, 2));
    });

    it("stays a suggestion rather than an announcement", () => {
        // It is a guess about the music, where a written slur is a reading of it. An arch
        // that announced itself would impose a shape the composer did not write.
        const swing = assumedPhraseWeight(bars, 2) - assumedPhraseWeight(bars, 0);
        expect(swing).toBeGreaterThan(0.02);
        expect(swing).toBeLessThan(0.12);
    });

    it("turns smoothly at the top, so the peak is not heard as an accent", () => {
        const near = assumedPhraseWeight(bars, 2);
        const either = [assumedPhraseWeight(bars, 1.8), assumedPhraseWeight(bars, 2.2)];
        for (const side of either) {
            expect(Math.abs(near - side)).toBeLessThan(0.01);
        }
    });

    it("says nothing where the piece has no bars to count", () => {
        expect(assumedPhraseWeight([], 3)).toBe(1);
    });
});

describe("interpretedWeight over an unmarked score", () => {
    const bars = Array.from({ length: 8 }, (_, index) => ({
        from: index,
        beats: 4,
        beatType: 4,
    }));

    it("gives a written slur the last word", () => {
        // A piece that phrases itself is played the way it asks; the assumed arch is only
        // for where the score is silent.
        const slur = [{ from: 0, to: 4 }];
        const slurred = interpretedWeight(bars, slur, 3.9);
        const bare = interpretedWeight(bars, [], 3.9);
        expect(slurred).not.toBeCloseTo(bare);
    });

    it("varies more than the bar's own stresses alone could", () => {
        // The whole complaint: with only metrical stress an unmarked piece moved by a sixth
        // in loudness and by nothing else at all, so every four bars were identical to the
        // last four. Sampled at every beat of the group — sampling only downbeats would
        // miss most of the range, since the arch's own low point sits on the first of them.
        // Measured against the bar's own stresses over the SAME moments, which is the only
        // comparison that means anything: the two are different shapes, and sampling one at
        // points that flatter it proves nothing.
        const at: number[] = [];
        for (let step = 0; step < 4; step += 0.125) {
            at.push(step);
        }
        const spread = (of: (whole: number) => number) => {
            const readings = at.map(of);
            return Math.max(...readings) - Math.min(...readings);
        };
        const shaped = spread((whole) => interpretedWeight(bars, [], whole));
        const stresses = spread((whole) => metricalWeight(bars, whole));
        expect(shaped).toBeGreaterThan(stresses);
    });
});

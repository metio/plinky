// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { interpretedWeight, metricalWeight, phraseWeight, placeInBar } from "./interpretation";
import type { XmlBar } from "./musicxmlTimeline";

const fourFour: XmlBar[] = [
    { from: 0, beats: 4, beatType: 4 },
    { from: 1, beats: 4, beatType: 4 },
];
const threeFour: XmlBar[] = [{ from: 0, beats: 3, beatType: 4 }];
const sixEight: XmlBar[] = [{ from: 0, beats: 6, beatType: 8 }];

describe("where a note sits in its bar", () => {
    it("counts beats from the barline", () => {
        expect(placeInBar(fourFour, 0)).toEqual({ beat: 0, beats: 4 });
        expect(placeInBar(fourFour, 0.25)).toEqual({ beat: 1, beats: 4 });
        expect(placeInBar(fourFour, 0.75)).toEqual({ beat: 3, beats: 4 });
    });

    it("counts from the bar the note is actually in", () => {
        expect(placeInBar(fourFour, 1)).toEqual({ beat: 0, beats: 4 });
        expect(placeInBar(fourFour, 1.5)).toEqual({ beat: 2, beats: 4 });
    });

    it("keeps counting past the last bar the file declares", () => {
        // A metre stands until another is written, and a repeat brings the walk back over
        // bars it has already passed — neither should stop the beat being knowable.
        expect(placeInBar(threeFour, 0.75)).toEqual({ beat: 0, beats: 3 });
        expect(placeInBar(threeFour, 1.0)).toEqual({ beat: 1, beats: 3 });
    });

    it("says nothing for a score that states no metre", () => {
        expect(placeInBar([], 0)).toBeNull();
        expect(placeInBar([{ from: 0, beats: 0, beatType: 0 }], 0)).toBeNull();
    });

    it("counts a compound metre in its own beats", () => {
        expect(placeInBar(sixEight, 0)).toEqual({ beat: 0, beats: 6 });
        expect(placeInBar(sixEight, 0.375)).toEqual({ beat: 3, beats: 6 });
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
            expect(
                interpretedWeight(fourFour, [{ from: 0, to: 2 }], at),
            ).toBeGreaterThanOrEqual(0.7);
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

// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
    GOOD_MS,
    LENIENT_TOLERANCE,
    makeHit,
    type Onset,
    PERFECT_MS,
    PRECISE_TOLERANCE,
    rate,
    summarize,
    tempoScale,
    timingDeltas,
} from "./rhythm";

describe("rate", () => {
    it("is perfect at and within the perfect window", () => {
        expect(rate(0)).toBe("perfect");
        expect(rate(PERFECT_MS)).toBe("perfect");
    });

    it("is good between the windows", () => {
        expect(rate(PERFECT_MS + 1)).toBe("good");
        expect(rate(GOOD_MS)).toBe("good");
    });

    it("is off beyond the good window", () => {
        expect(rate(GOOD_MS + 1)).toBe("off");
    });

    it("widens the windows under a lenient tolerance", () => {
        expect(rate(PERFECT_MS * LENIENT_TOLERANCE, LENIENT_TOLERANCE)).toBe("perfect");
        expect(rate(GOOD_MS * LENIENT_TOLERANCE, LENIENT_TOLERANCE)).toBe("good");
        expect(rate(GOOD_MS * LENIENT_TOLERANCE + 1, LENIENT_TOLERANCE)).toBe("off");
    });
});

describe("makeHit", () => {
    it("rates on the absolute delta but keeps the sign", () => {
        expect(makeHit(3, -200)).toEqual({ index: 3, deltaMs: -200, rating: "off" });
        expect(makeHit(1, 30)).toEqual({ index: 1, deltaMs: 30, rating: "perfect" });
    });

    it("applies the tolerance so a wider miss can still pass", () => {
        // 141ms is off under the tight windows but lands in the widened good window.
        expect(makeHit(0, GOOD_MS + 1).rating).toBe("off");
        expect(makeHit(0, GOOD_MS + 1, LENIENT_TOLERANCE).rating).toBe("good");
    });
});

describe("tempoScale", () => {
    const onsets = (pairs: [number, number][]): Onset[] =>
        pairs.map(([targetMs, playedMs]) => ({ targetMs, playedMs }));

    it("is 1 for a run on the notated tempo", () => {
        expect(
            tempoScale(
                onsets([
                    [0, 0],
                    [100, 100],
                    [200, 200],
                ]),
            ),
        ).toBeCloseTo(1);
    });

    it("reflects a steady run played at half speed", () => {
        expect(
            tempoScale(
                onsets([
                    [0, 0],
                    [100, 200],
                    [200, 400],
                ]),
            ),
        ).toBeCloseTo(2);
    });

    it("falls back to 1 when there are no measurable gaps", () => {
        expect(tempoScale([])).toBe(1);
        expect(tempoScale(onsets([[0, 0]]))).toBe(1);
    });
});

describe("timingDeltas", () => {
    const onsets = (pairs: [number, number][]): Onset[] =>
        pairs.map(([targetMs, playedMs]) => ({ targetMs, playedMs }));

    it("anchors the first note at zero", () => {
        expect(
            timingDeltas(
                onsets([
                    [0, 0],
                    [100, 100],
                ]),
            )[0],
        ).toBe(0);
    });

    it("reads a steady run at any tempo as on-time", () => {
        const steady = onsets(Array.from({ length: 6 }, (_, i) => [i * 100, i * 200]));
        for (const delta of timingDeltas(steady)) {
            expect(delta).toBeCloseTo(0);
        }
    });

    it("flags a single rushed gap while the neighbours stay on pace", () => {
        // Steady 100ms gaps with one stretched to 250ms — only that note is +150 off.
        const deltas = timingDeltas(
            onsets([
                [0, 0],
                [100, 100],
                [200, 350],
                [300, 450],
                [400, 550],
                [500, 650],
            ]),
        );
        expect(deltas[2]).toBeCloseTo(150);
        expect(deltas[1]).toBeCloseTo(0);
        expect(deltas[3]).toBeCloseTo(0);
    });

    it("treats simultaneous onsets as on-time — a chord carries no rhythm", () => {
        expect(
            timingDeltas(
                onsets([
                    [0, 0],
                    [0, 40],
                ]),
            )[1],
        ).toBe(0);
    });
});

describe("summarize", () => {
    it("counts ratings and averages the absolute deltas", () => {
        const summary = summarize([makeHit(1, 20), makeHit(2, -100), makeHit(3, 300)]);
        expect(summary).toEqual({
            perfect: 1,
            good: 1,
            off: 1,
            total: 3,
            averageAbsMs: (20 + 100 + 300) / 3,
        });
    });

    it("handles an empty run", () => {
        expect(summarize([])).toEqual({ perfect: 0, good: 0, off: 0, total: 0, averageAbsMs: 0 });
    });
});

describe("timing slack", () => {
    it("changes nothing when there is none", () => {
        for (const delta of [0, 59, 60, 61, 139, 140, 141, 900]) {
            expect(rate(delta, PRECISE_TOLERANCE, 0)).toBe(rate(delta, PRECISE_TOLERANCE));
        }
    });

    it("never rates a note worse than it would without slack", () => {
        const order = { off: 0, good: 1, perfect: 2 } as const;
        for (const delta of [0, 50, 100, 200, 500, 1200]) {
            for (const slack of [0, 10, 250, 1000]) {
                expect(order[rate(delta, PRECISE_TOLERANCE, slack)]).toBeGreaterThanOrEqual(
                    order[rate(delta, PRECISE_TOLERANCE)],
                );
            }
        }
    });

    it("accepts a note as far out as the slack allows", () => {
        // A player who leans on an ornament rather than crushing it lands half a beat
        // from where the step model put it, and is not marked down for the choice.
        expect(rate(500, PRECISE_TOLERANCE)).toBe("off");
        expect(rate(500, PRECISE_TOLERANCE, 500)).toBe("perfect");
    });

    it("still calls a note that misses by more than the slack off", () => {
        expect(rate(2000, PRECISE_TOLERANCE, 500)).toBe("off");
    });

    it("ignores a negative slack rather than tightening the window", () => {
        expect(rate(50, PRECISE_TOLERANCE, -1000)).toBe("perfect");
    });
});

// SPDX-FileCopyrightText: The Klimpi Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
    DOMAIN,
    drawnWordmark,
    TITTLE,
    TRACKING,
    stemPrefixes,
    tittleCircle,
    WORDMARK,
    WORDMARK_PARTS,
    wordmarkText,
} from "./wordmark";

describe("wordmarkText", () => {
    it("is the name, with the domain as its own tail when asked", () => {
        expect(wordmarkText(false)).toBe(WORDMARK);
        expect(wordmarkText(true)).toBe(`${WORDMARK}${DOMAIN}`);
        expect(wordmarkText(true)).toBe("Klimpi.app");
    });
});

describe("the name as it is drawn", () => {
    it("is the same letters with dotless stems, so the drawn dots are the only ones", () => {
        expect(drawnWordmark(false)).toBe("Klımpı");
        expect(drawnWordmark(true)).toBe("Klımpı.app");
        expect(WORDMARK_PARTS.stem).toBe("ı");
        expect(drawnWordmark(false).replaceAll(WORDMARK_PARTS.stem, "i")).toBe(WORDMARK);
    });

    it("has a stem for every i in the name, and a prefix for every stem", () => {
        const dotted = [...WORDMARK].filter((letter) => letter === "i").length;
        expect(WORDMARK_PARTS.runs).toHaveLength(dotted + 1);
        expect(stemPrefixes()).toHaveLength(dotted);
    });

    it("gives each stem the letters that stand before it, so a dot lands on every one", () => {
        expect(stemPrefixes()).toEqual(["Kl", "Klımp"]);
        for (const prefix of stemPrefixes()) {
            expect(drawnWordmark(false).startsWith(prefix)).toBe(true);
            expect(drawnWordmark(false)[prefix.length]).toBe(WORDMARK_PARTS.stem);
        }
    });
});

describe("the dot over an i", () => {
    it("sits over the stem, with its underside where the face puts its own tittle", () => {
        const size = 40;
        const { cx, cy, r } = tittleCircle(100, 200, size);
        expect(cx).toBeCloseTo(100 + size * TITTLE.stemCentre, 10);
        expect(cy + r).toBeCloseTo(200 - size * TITTLE.baseAbove, 10);
        expect(r * 2).toBeCloseTo(size * TITTLE.size, 10);
    });

    it("grows with the type it sits on", () => {
        const small = tittleCircle(0, 0, 10);
        const large = tittleCircle(0, 0, 20);
        expect(large.r).toBeCloseTo(small.r * 2, 10);
        expect(large.cy).toBeCloseTo(small.cy * 2, 10);
        expect(large.cx).toBeCloseTo(small.cx * 2, 10);
    });
});

describe("the tracking", () => {
    it("opens the name up on a dark ground and leaves it as set on a light one", () => {
        expect(TRACKING.light).toBe(0);
        expect(TRACKING.dark).toBeGreaterThan(TRACKING.light);
    });
});

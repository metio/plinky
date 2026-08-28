// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { finishFor, GLOSSY, JOYFUL, KEYBOARD_FINISHES } from "./keyboardFinish";

describe("keyboard finishes", () => {
    it("starts joyful, which is what somebody who has never played sees first", () => {
        expect(finishFor()).toBe(JOYFUL);
        expect(KEYBOARD_FINISHES[0]).toBe(JOYFUL);
    });

    it("draws no lip and no shading when joyful, so a key is a flat friendly tile", () => {
        expect(JOYFUL.lip).toBe(0);
        expect(JOYFUL.sheen).toBe(0);
        expect(JOYFUL.shade).toBe(0);
    });

    it("keeps the numbers the video painter had baked in when glossy", () => {
        // A clip rendered glossy has to look exactly as clips did before the finish was a
        // choice, or every promo already posted stops matching the ones after it.
        expect(GLOSSY).toMatchObject({ lip: 0.09, sheen: 0.22, shade: 0.14 });
    });

    it("rounds a joyful key more than a glossy one, which is most of the difference", () => {
        expect(JOYFUL.radius).toBeGreaterThan(GLOSSY.radius);
    });

    it("answers an unknown or absent id with the default rather than nothing", () => {
        // A finish saved by a build that knew one this does not is a look we cannot draw,
        // not an error worth showing somebody mid-practice.
        expect(finishFor("glossy")).toBe(GLOSSY);
        expect(finishFor("joyful")).toBe(JOYFUL);
        expect(finishFor("holographic")).toBe(JOYFUL);
        expect(finishFor(undefined)).toBe(JOYFUL);
        expect(finishFor("")).toBe(JOYFUL);
    });

    it("gives every finish a distinct id, since the id is what is stored", () => {
        const ids = KEYBOARD_FINISHES.map((finish) => finish.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("keeps every proportion a fraction, since each is a share of the key", () => {
        // Named rather than walked: a finish carries class strings as well as numbers, and
        // "every field except the id" quietly asserted that a Tailwind class was a fraction.
        for (const finish of KEYBOARD_FINISHES) {
            for (const name of ["lip", "sheen", "shade", "radius"] as const) {
                expect(finish[name], `${finish.id}.${name}`).toBeGreaterThanOrEqual(0);
                expect(finish[name], `${finish.id}.${name}`).toBeLessThan(1);
            }
        }
    });

    it("carries a class for every face the page draws", () => {
        for (const finish of KEYBOARD_FINISHES) {
            for (const name of ["whiteKey", "blackKey", "well"] as const) {
                expect(finish[name], `${finish.id}.${name}`).toBeTruthy();
            }
        }
    });
});

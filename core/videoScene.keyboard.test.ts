// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { KEY_LONGEST, KEY_SHORTEST, keyboardHeightFor } from "./videoScene";

describe("keyboardHeightFor", () => {
    it("leaves a keyboard alone when its keys already have a shape a piano could have", () => {
        // The app's landscape export: 78.5px wide keys, 302px tall — about 1:3.9.
        expect(keyboardHeightFor(302, 78.5)).toBe(302);
    });

    it("cuts a portrait keyboard down to a key that is not a stripe", () => {
        // A promo short: 44.2px wide keys asked to be 538px tall, which is 1:12.2.
        const height = keyboardHeightFor(538, 44.2);
        expect(height).toBeCloseTo(44.2 * KEY_LONGEST);
        expect(height / 44.2).toBeLessThanOrEqual(KEY_LONGEST);
    });

    it("lifts a keyboard so squat that a key reads as a tile", () => {
        expect(keyboardHeightFor(40, 44.2)).toBeCloseTo(44.2 * KEY_SHORTEST);
    });

    it("keeps the square promo, which was already within the band", () => {
        // 44.2 wide by 302 tall is 1:6.8 — the closest of the three to a real key.
        expect(keyboardHeightFor(302, 44.2)).toBe(302);
    });

    it("answers with what it was asked when there is no key width to judge by", () => {
        expect(keyboardHeightFor(302, 0)).toBe(302);
        expect(keyboardHeightFor(302, Number.NaN)).toBe(302);
    });
});

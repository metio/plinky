// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { ASSISTED_COLOR, foundColor, PLAYED_COLOR } from "./scoreCanvas";

describe("foundColor", () => {
    it("greens a position read cleanly", () => {
        expect(foundColor({ stumbled: false, wrongBefore: 0 })).toBe(PLAYED_COLOR);
    });

    it("ambers a position that took a wrong key first", () => {
        expect(foundColor({ stumbled: true, wrongBefore: 1 })).toBe(ASSISTED_COLOR);
    });

    it("ambers a position the forgiving advance moved past", () => {
        // A skip fires no wrong key, so the run has no stumble on record there; the miss
        // arrives only as the cleared position's wrongBefore.
        expect(foundColor({ stumbled: false, wrongBefore: 1 })).toBe(ASSISTED_COLOR);
    });

    it("keeps a stumble from an earlier pass of a loop", () => {
        expect(foundColor({ stumbled: true, wrongBefore: 0 })).toBe(ASSISTED_COLOR);
    });

    it("is green exactly when nothing went wrong there", () => {
        fc.assert(
            fc.property(fc.boolean(), fc.nat({ max: 50 }), (stumbled, wrongBefore) => {
                expect(foundColor({ stumbled, wrongBefore }) === PLAYED_COLOR).toBe(
                    !stumbled && wrongBefore === 0,
                );
            }),
        );
    });
});

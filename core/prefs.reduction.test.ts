// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { parsePrefs } from "./prefs";
import { REDUCTIONS } from "./reduction";

describe("the reduction preference", () => {
    it("starts at the piece as written", () => {
        // A reading aid nobody asked for is a piece with notes missing. Every player meets
        // the score the composer wrote until they choose otherwise.
        expect(parsePrefs(null).reduction).toBe("");
    });

    it("keeps a stored reduction", () => {
        for (const level of REDUCTIONS) {
            expect(parsePrefs(JSON.stringify({ reduction: level })).reduction).toBe(level);
        }
    });

    it("falls back to the piece as written when the stored level is unknown", () => {
        // A value from a build that knew a reduction this one does not is a reading we
        // cannot draw. Showing every note is the safe answer; showing an arbitrary one is
        // silently taking notes out of somebody's score.
        expect(parsePrefs('{"reduction":"halved"}').reduction).toBe("");
        expect(parsePrefs('{"reduction":7}').reduction).toBe("");
        expect(parsePrefs('{"reduction":null}').reduction).toBe("");
    });
});

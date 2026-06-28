// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { hasSeenHint, markHintSeen } from "./seenHints";

afterEach(() => localStorage.clear());

describe("seenHints", () => {
    it("remembers a hint once it's marked seen", () => {
        expect(hasSeenHint("intro")).toBe(false);
        markHintSeen("intro");
        expect(hasSeenHint("intro")).toBe(true);
        // Other hints are unaffected.
        expect(hasSeenHint("other")).toBe(false);
    });
});

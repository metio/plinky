// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { atEnd, FOLLOW_SLACK_PX } from "./followScroll";

describe("atEnd", () => {
    it("is true for a panel with nothing to scroll", () => {
        // A sketch shorter than its box follows from the very first note.
        expect(atEnd({ scrollTop: 0, clientHeight: 400, scrollHeight: 200 })).toBe(true);
        expect(atEnd({ scrollTop: 0, clientHeight: 400, scrollHeight: 400 })).toBe(true);
    });

    it("is true when scrolled to the bottom", () => {
        expect(atEnd({ scrollTop: 600, clientHeight: 400, scrollHeight: 1000 })).toBe(true);
    });

    it("forgives a few pixels short of the bottom", () => {
        // A rendered staff rarely lands on an exact boundary.
        expect(atEnd({ scrollTop: 600 - FOLLOW_SLACK_PX, clientHeight: 400, scrollHeight: 1000 })).toBe(
            true,
        );
    });

    it("is false once the reader has scrolled back to look at something", () => {
        expect(atEnd({ scrollTop: 0, clientHeight: 400, scrollHeight: 1000 })).toBe(false);
        expect(atEnd({ scrollTop: 300, clientHeight: 400, scrollHeight: 1000 })).toBe(false);
    });

    it("takes hold again when they scroll back down", () => {
        const box = { scrollTop: 0, clientHeight: 400, scrollHeight: 1000 };
        expect(atEnd(box)).toBe(false);
        expect(atEnd({ ...box, scrollTop: 600 })).toBe(true);
    });

    it("takes the slack as given", () => {
        const box = { scrollTop: 500, clientHeight: 400, scrollHeight: 1000 };
        expect(atEnd(box, 0)).toBe(false);
        expect(atEnd(box, 100)).toBe(true);
    });
});

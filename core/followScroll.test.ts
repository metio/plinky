// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { atEnd, FOLLOW_SLACK_PX, outOfView } from "./followScroll";

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
        expect(
            atEnd({ scrollTop: 600 - FOLLOW_SLACK_PX, clientHeight: 400, scrollHeight: 1000 }),
        ).toBe(true);
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

describe("outOfView", () => {
    const PHONE = 844;
    // A panel of a realistic height, since the whole question is about both its edges.
    const tall = 600;

    it("leaves a panel the reader can already see where it is", () => {
        expect(outOfView(0, tall, PHONE)).toBe(false);
        expect(outOfView(320, 320 + tall, PHONE)).toBe(false);
        // Its top edge on the last line of the screen still counts as seen: the reader
        // knows something is there, and a scroll would move the page under them.
        expect(outOfView(PHONE - 1, PHONE - 1 + tall, PHONE)).toBe(false);
    });

    it("leaves a panel whose top has scrolled past but whose body fills the screen", () => {
        // The bug this exists for. On a wide screen the list and the detail sit side by
        // side, so the detail is always visible — but its top goes negative the moment the
        // reader scrolls at all. Asked about the top alone, every choice made after
        // scrolling yanked the page by however far it had gone.
        expect(outOfView(-29, -29 + tall, PHONE)).toBe(false);
        expect(outOfView(-599, 1, PHONE)).toBe(false);
    });

    it("fetches a panel that is entirely off one edge or the other", () => {
        // Above: the reader has read right past the explanation.
        expect(outOfView(-tall, 0, PHONE)).toBe(true);
        expect(outOfView(-900, -300, PHONE)).toBe(true);
        // Below: the list fills the screen and the explanation is under all of it.
        expect(outOfView(PHONE, PHONE + tall, PHONE)).toBe(true);
        expect(outOfView(PHONE + 1, PHONE + 1 + tall, PHONE)).toBe(true);
    });

    it("says nothing is out of view when the panel has no height yet", () => {
        // A panel measured before it has drawn anything is a zero-height box at the top of
        // wherever it sits. Fetching one the reader is already looking at is the very thing
        // this guard is for.
        expect(outOfView(0, 0, PHONE)).toBe(true);
        expect(outOfView(300, 300, PHONE)).toBe(false);
    });
});

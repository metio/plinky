// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { NoteTimingEvent } from "abcjs";
import { describe, expect, it } from "vitest";
import { pitchesOf } from "./steps";

// buildSteps itself depends on abcjs populating midiPitches, which only happens
// under a real browser — that path is covered by steps.browser.test.ts. The
// pitch extraction it builds on is pure and checked here.
function event(pitches: number[]): NoteTimingEvent {
    return { midiPitches: pitches.map((pitch) => ({ pitch })) } as unknown as NoteTimingEvent;
}

describe("pitchesOf", () => {
    it("returns an empty array when an event has no pitches", () => {
        expect(pitchesOf(event([]))).toEqual([]);
        expect(pitchesOf({} as NoteTimingEvent)).toEqual([]);
    });

    it("extracts a single pitch", () => {
        expect(pitchesOf(event([60]))).toEqual([60]);
    });

    it("extracts every pitch of a chord in order", () => {
        expect(pitchesOf(event([60, 64, 67]))).toEqual([60, 64, 67]);
    });
});

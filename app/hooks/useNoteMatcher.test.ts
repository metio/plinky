// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { NoteTimingEvent } from "abcjs";
import { describe, expect, it } from "vitest";
import { expectedPitches } from "./useNoteMatcher";

function eventWith(pitches: number[]): NoteTimingEvent {
    return { midiPitches: pitches.map((pitch) => ({ pitch })) } as unknown as NoteTimingEvent;
}

describe("expectedPitches", () => {
    it("returns an empty array for a missing event", () => {
        expect(expectedPitches(undefined)).toEqual([]);
    });

    it("returns an empty array when the event carries no pitches", () => {
        expect(expectedPitches(eventWith([]))).toEqual([]);
    });

    it("extracts the MIDI pitch numbers in order", () => {
        expect(expectedPitches(eventWith([60, 64, 67]))).toEqual([60, 64, 67]);
    });
});

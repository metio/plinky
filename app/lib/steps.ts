// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { NoteTimingEvent, TuneObject } from "abcjs";

// A single playable step in a phrase: the set of pitches to sound together (one
// for a single note, several for a chord), its notated onset, and the score
// elements to recolor. Rests and tie continuations carry no pitches and are
// dropped, so their duration survives only as the gap to the next step's onset.
export type Step = {
    pitches: number[];
    timeMs: number;
    elements: HTMLElement[];
};

export function pitchesOf(event: NoteTimingEvent): number[] {
    return event.midiPitches?.map((pitch) => pitch.pitch) ?? [];
}

// Flatten an abcjs timeline into playable steps. setupEvents already expands
// repeats and voltas and folds rests into absolute onsets, so chords (one event,
// many pitches) are the only structural difference from a plain melody.
export function buildSteps(tune: TuneObject, tempo: number): Step[] {
    // setupEvents only copies pitch data that the MIDI flattener has already
    // attached, so prime it first — without setUpAudio every event comes back
    // with no midiPitches and nothing is playable.
    tune.setUpAudio({});
    return tune
        .setupEvents(0, 1000, tempo)
        .filter((event) => event.type === "event")
        .map((event) => ({
            pitches: pitchesOf(event),
            timeMs: event.milliseconds,
            elements: (event.elements ?? []).flat(),
        }))
        .filter((step) => step.pitches.length > 0);
}

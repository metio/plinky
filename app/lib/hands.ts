// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { NoteTimingEvent, TuneObject } from "abcjs";

// A hand is one staff's stream of steps. abcjs merges voices into a single timed
// sequence, so we split it back apart by staff: `tune.lines[].staff[]` gives each
// note's staff, and every MIDI pitch carries the `startChar` that ties it back to
// a notated note — the reliable join between the merged timeline and the score.

export type HandStep = {
    pitches: number[];
    timeMs: number;
};

export type Hand = {
    staff: number; // 0 = top staff (right hand), 1 = bottom staff (left hand)
    label: string;
    steps: HandStep[];
};

type TimingEvent = { milliseconds: number; midiPitches?: { pitch: number; startChar: number }[] };

function handLabel(staff: number): string {
    if (staff === 0) {
        return "Right";
    }
    if (staff === 1) {
        return "Left";
    }
    return `Voice ${staff + 1}`;
}

// Partition a merged timeline into per-staff hands. Pure, so it is unit-tested
// without abcjs: callers pass the events and the startChar→staff map.
export function groupByHand(events: TimingEvent[], staffOf: Map<number, number>): Hand[] {
    const byStaff = new Map<number, HandStep[]>();
    for (const event of events) {
        const perStaff = new Map<number, number[]>();
        for (const note of event.midiPitches ?? []) {
            const staff = staffOf.get(note.startChar) ?? 0;
            const pitches = perStaff.get(staff) ?? [];
            pitches.push(note.pitch);
            perStaff.set(staff, pitches);
        }
        for (const [staff, pitches] of perStaff) {
            const steps = byStaff.get(staff) ?? [];
            steps.push({ pitches, timeMs: event.milliseconds });
            byStaff.set(staff, steps);
        }
    }
    return [...byStaff.keys()]
        .sort((a, b) => a - b)
        .map((staff) => ({ staff, label: handLabel(staff), steps: byStaff.get(staff) ?? [] }));
}

// Map every notated note's startChar to the staff it sits on.
function startCharToStaff(tune: TuneObject): Map<number, number> {
    const map = new Map<number, number>();
    for (const line of tune.lines) {
        const staves = line.staff;
        if (!staves) {
            continue;
        }
        staves.forEach((staff, staffIndex) => {
            for (const voice of staff.voices ?? []) {
                for (const element of voice as Array<{ el_type: string; startChar?: number }>) {
                    if (element.el_type === "note" && typeof element.startChar === "number") {
                        map.set(element.startChar, staffIndex);
                    }
                }
            }
        });
    }
    return map;
}

export function buildHands(tune: TuneObject, tempo: number): Hand[] {
    // setUpAudio attaches the midiPitches that setupEvents copies; without it the
    // events carry no pitches (and no startChar to split on).
    tune.setUpAudio({});
    const staffOf = startCharToStaff(tune);
    // abcjs's MidiPitch type omits startChar, which is present at runtime and is
    // our join key, so map into the shape groupByHand expects.
    const events = tune
        .setupEvents(0, 1000, tempo)
        .filter((event): event is NoteTimingEvent => event.type === "event")
        .map((event) => ({
            milliseconds: event.milliseconds,
            midiPitches: (event.midiPitches ?? []).map((note) => ({
                pitch: note.pitch,
                startChar: (note as { startChar?: number }).startChar ?? 0,
            })),
        }));
    return groupByHand(events, staffOf);
}

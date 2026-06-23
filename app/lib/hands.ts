// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { TuneObject } from "abcjs";

// A hand is one staff's stream of steps. abcjs merges voices into a single timed
// sequence, so we split it back apart by staff: pitches carry the `startChar`
// that ties them to a notated note, and rendered note elements carry an
// `abcjs-vN` voice class — together they assign every note to a hand.

export type HandStep = {
    pitches: number[];
    timeMs: number;
    elements: HTMLElement[];
};

export type Hand = {
    staff: number; // 0 = top staff (right hand), 1 = bottom staff (left hand)
    label: string;
    steps: HandStep[];
};

// One staff's notes at a single onset — the unit groupByHand sequences.
export type StaffOnset = {
    staff: number;
    pitches: number[];
    elements: HTMLElement[];
    timeMs: number;
};

type TimingEvent = {
    milliseconds: number;
    midiPitches?: { pitch: number; startChar: number }[];
    elements?: HTMLElement[][];
};

function handLabel(staff: number): string {
    if (staff === 0) {
        return "Right";
    }
    if (staff === 1) {
        return "Left";
    }
    return `Voice ${staff + 1}`;
}

// Sequence per-staff onsets into a step list per hand. Pure, so it is unit-tested
// without abcjs.
export function groupByHand(onsets: StaffOnset[]): Hand[] {
    const byStaff = new Map<number, HandStep[]>();
    for (const onset of onsets) {
        if (onset.pitches.length === 0) {
            continue;
        }
        const steps = byStaff.get(onset.staff) ?? [];
        steps.push({ pitches: onset.pitches, timeMs: onset.timeMs, elements: onset.elements });
        byStaff.set(onset.staff, steps);
    }
    return [...byStaff.keys()]
        .sort((a, b) => a - b)
        .map((staff) => ({ staff, label: handLabel(staff), steps: byStaff.get(staff) ?? [] }));
}

// Map each notated note's startChar to the staff it sits on.
function startCharToStaff(tune: TuneObject): Map<number, number> {
    const map = new Map<number, number>();
    for (const line of tune.lines) {
        line.staff?.forEach((staff, staffIndex) => {
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

// Map each voice index (as it appears in the abcjs-vN element class) to its staff.
function voiceToStaff(tune: TuneObject): Map<number, number> {
    const map = new Map<number, number>();
    let voice = 0;
    const line = tune.lines.find((candidate) => candidate.staff);
    line?.staff?.forEach((staff, staffIndex) => {
        const count = staff.voices?.length ?? 1;
        for (let i = 0; i < count; i++) {
            map.set(voice++, staffIndex);
        }
    });
    return map;
}

function voiceOfElement(group: HTMLElement[]): number {
    for (const node of group) {
        const match = node.getAttribute?.("class")?.match(/abcjs-v(\d+)/);
        if (match) {
            return Number(match[1]);
        }
    }
    return 0;
}

export function buildHands(tune: TuneObject, tempo: number): Hand[] {
    // setUpAudio attaches the midiPitches that setupEvents copies; without it the
    // events carry no pitches (and no startChar to split on).
    tune.setUpAudio({});
    const staffOf = startCharToStaff(tune);
    const voiceStaff = voiceToStaff(tune);

    const onsets: StaffOnset[] = [];
    for (const event of tune.setupEvents(0, 1000, tempo) as TimingEvent[]) {
        if (!event.midiPitches) {
            continue;
        }
        const byStaff = new Map<number, { pitches: number[]; elements: HTMLElement[] }>();
        const bucket = (staff: number) => {
            const existing = byStaff.get(staff);
            if (existing) {
                return existing;
            }
            const created = { pitches: [] as number[], elements: [] as HTMLElement[] };
            byStaff.set(staff, created);
            return created;
        };
        for (const note of event.midiPitches) {
            // abcjs's MidiPitch type omits startChar, present at runtime.
            const startChar = (note as { startChar?: number }).startChar ?? 0;
            bucket(staffOf.get(startChar) ?? 0).pitches.push(note.pitch);
        }
        for (const group of event.elements ?? []) {
            bucket(voiceStaff.get(voiceOfElement(group)) ?? 0).elements.push(...group);
        }
        for (const [staff, contents] of byStaff) {
            onsets.push({ staff, timeMs: event.milliseconds, ...contents });
        }
    }
    return groupByHand(onsets);
}

export function totalSteps(hands: Hand[]): number {
    return hands.reduce((sum, hand) => sum + hand.steps.length, 0);
}

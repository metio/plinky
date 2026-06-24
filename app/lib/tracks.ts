// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// A track is an ordered path through the catalog — a graded progression to work
// up, or a timed routine to play in a session. Unlike a curriculum (an unordered
// collection), a track carries order and progress. Nothing is ever locked: every
// step is playable; the order is a suggestion and progress is just encouragement.

export type TrackKind = "progression" | "routine";

export interface Track {
    id: string;
    name: string;
    description: string;
    kind: TrackKind;
    minutes?: number; // a rough session length, for routines
    songIds: string[]; // in order
}

export type TrackStatus = "done" | "current" | "upcoming";
export type TrackStep = { songId: string; status: TrackStatus };

// Mark each step done/current/upcoming. The first not-yet-done step is "current"
// (the suggested next thing); everything else upcoming. No step is ever locked.
export function trackSteps(songIds: string[], isDone: (id: string) => boolean): TrackStep[] {
    let currentAssigned = false;
    return songIds.map((songId) => {
        if (isDone(songId)) {
            return { songId, status: "done" };
        }
        if (!currentAssigned) {
            currentAssigned = true;
            return { songId, status: "current" };
        }
        return { songId, status: "upcoming" };
    });
}

const MAJOR_CIRCLE = [
    "scale-c-major",
    "scale-g-major",
    "scale-d-major",
    "scale-a-major",
    "scale-e-major",
    "scale-b-major",
    "scale-gflat-major",
    "scale-dflat-major",
    "scale-aflat-major",
    "scale-eflat-major",
    "scale-bflat-major",
    "scale-f-major",
];

const MINOR_CIRCLE = [
    "scale-a-minor",
    "scale-e-minor",
    "scale-b-minor",
    "scale-fsharp-minor",
    "scale-csharp-minor",
    "scale-gsharp-minor",
    "scale-eflat-minor",
    "scale-bflat-minor",
    "scale-f-minor",
    "scale-c-minor",
    "scale-g-minor",
    "scale-d-minor",
];

export const TRACKS = [
    {
        id: "technique-foundations",
        name: "Technique foundations",
        description: "Build core finger technique from the ground up.",
        kind: "progression",
        songIds: [
            "five-finger-c",
            "scale-c-major",
            "arpeggio-c-major",
            "scale-g-major",
            "arpeggio-g-major",
            "scale-f-major",
            "arpeggio-f-major",
            "chromatic-c",
            "contrary-motion-c",
            "hanon-1",
        ],
    },
    {
        id: "major-scales-circle",
        name: "Major scales — circle of fifths",
        description: "All twelve major scales, around the circle of fifths.",
        kind: "progression",
        songIds: MAJOR_CIRCLE,
    },
    {
        id: "minor-scales-circle",
        name: "Minor scales — circle of fifths",
        description: "All twelve natural-minor scales, around the circle of fifths.",
        kind: "progression",
        songIds: MINOR_CIRCLE,
    },
    {
        id: "major-arpeggios-circle",
        name: "Major arpeggios — circle of fifths",
        description: "Every major arpeggio, around the circle of fifths.",
        kind: "progression",
        songIds: MAJOR_CIRCLE.map((id) => id.replace("scale-", "arpeggio-")),
    },
    {
        id: "warm-up-5",
        name: "5-minute warm-up",
        description: "A quick daily loosener.",
        kind: "routine",
        minutes: 5,
        songIds: ["five-finger-c", "scale-c-major", "arpeggio-c-major"],
    },
    {
        id: "technique-15",
        name: "15-minute technique",
        description: "A fuller technique session.",
        kind: "routine",
        minutes: 15,
        songIds: [
            "five-finger-c",
            "scale-c-major",
            "scale-g-major",
            "arpeggio-c-major",
            "arpeggio-g-major",
            "hanon-1",
            "chromatic-c",
        ],
    },
] satisfies Track[];

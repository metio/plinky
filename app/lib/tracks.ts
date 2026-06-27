// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { assignmentToTrack, loadAssignments } from "./assignment";

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
    scoreIds: string[]; // in order
}

export type TrackStatus = "done" | "current" | "upcoming";
export type TrackStep = { scoreId: string; status: TrackStatus };

// Mark each step done/current/upcoming. The first not-yet-done step is "current"
// (the suggested next thing); everything else upcoming. No step is ever locked.
export function trackSteps(scoreIds: string[], isDone: (id: string) => boolean): TrackStep[] {
    let currentAssigned = false;
    return scoreIds.map((scoreId) => {
        if (isDone(scoreId)) {
            return { scoreId, status: "done" };
        }
        if (!currentAssigned) {
            currentAssigned = true;
            return { scoreId, status: "current" };
        }
        return { scoreId, status: "upcoming" };
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
        scoreIds: [
            "scale-c-major",
            "arpeggio-c-major",
            "scale-g-major",
            "arpeggio-g-major",
            "scale-f-major",
            "arpeggio-f-major",
        ],
    },
    {
        id: "major-scales-circle",
        name: "Major scales — circle of fifths",
        description: "All twelve major scales, around the circle of fifths.",
        kind: "progression",
        scoreIds: MAJOR_CIRCLE,
    },
    {
        id: "minor-scales-circle",
        name: "Minor scales — circle of fifths",
        description: "All twelve natural-minor scales, around the circle of fifths.",
        kind: "progression",
        scoreIds: MINOR_CIRCLE,
    },
    {
        id: "major-arpeggios-circle",
        name: "Major arpeggios — circle of fifths",
        description: "Every major arpeggio, around the circle of fifths.",
        kind: "progression",
        scoreIds: MAJOR_CIRCLE.map((id) => id.replace("scale-", "arpeggio-")),
    },
    {
        id: "warm-up-5",
        name: "5-minute warm-up",
        description: "A quick daily loosener.",
        kind: "routine",
        minutes: 5,
        scoreIds: ["scale-c-major", "arpeggio-c-major", "scale-g-major"],
    },
    {
        id: "technique-15",
        name: "15-minute technique",
        description: "A fuller technique session.",
        kind: "routine",
        minutes: 15,
        scoreIds: [
            "scale-c-major",
            "scale-g-major",
            "scale-d-major",
            "arpeggio-c-major",
            "arpeggio-g-major",
            "arpeggio-d-major",
        ],
    },
] satisfies Track[];

// Every track to show: the built-in progressions and routines, then the player's
// own imported assignments (teacher-built, or their own) appended after them.
export function loadTracks(): Track[] {
    return [...TRACKS, ...loadAssignments().map(assignmentToTrack)];
}

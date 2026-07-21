// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { ExerciseConfig, Hands } from "./exerciseGen";

// The endless sight-reading arcade: a ladder of generated scale and arpeggio exercises
// that never runs out, each a fresh phrase to read at sight. Clearing one (mastering it,
// the same signal the grade ladder uses) opens the next, harder rung — so the arcade is a
// self-driving climb built entirely from the exercise generator and the mastery the play
// surface already records, with no bespoke run loop.

// The twelve major keys, ordered by accidental count so the climb sharpens gradually.
const KEYS = ["c", "g", "f", "d", "bflat", "a", "eflat", "e", "aflat", "b", "dflat", "gflat"];

// Each stage is a harder shape than the last; within a stage the twelve keys are the
// finer steps. Only major-key scales and arpeggios, so every generated key slug is valid.
const STAGES: { type: ExerciseConfig["type"]; octaves: 1 | 2; hands: Hands }[] = [
    { type: "major-scale", octaves: 1, hands: "right" },
    { type: "major-scale", octaves: 1, hands: "left" },
    { type: "major-scale", octaves: 2, hands: "right" },
    { type: "major-scale", octaves: 2, hands: "both" },
    { type: "major-arpeggio", octaves: 1, hands: "right" },
    { type: "major-arpeggio", octaves: 2, hands: "both" },
];

// The exercise for a 1-based arcade level: walk the keys within a stage, then step up to
// the next stage; the final stage repeats its keys forever so the ladder never ends.
export function arcadeConfig(level: number): ExerciseConfig {
    const index = Math.max(0, level - 1);
    const stage = STAGES[Math.min(Math.floor(index / KEYS.length), STAGES.length - 1)]!;
    const key = KEYS[index % KEYS.length]!;
    return {
        type: stage.type,
        key,
        octaves: stage.octaves,
        hands: stage.hands,
        inversion: 0,
        interval: "single",
    };
}

// The rung the player is on: the first level they have not yet cleared, walking up from 1.
// `cleared` reports whether a level's exercise is mastered; `max` caps the walk so an
// all-cleared run (or a broken predicate) can't loop forever.
export function currentArcadeLevel(cleared: (level: number) => boolean, max = 500): number {
    let level = 1;
    while (level < max && cleared(level)) {
        level += 1;
    }
    return level;
}

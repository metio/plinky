// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Grade } from "../../../core/grade";
import type { Grid, RunNote } from "../../../core/shareCard";
import { RunResult } from "./runResult";

// Purely presentational: every readout derives from the pinned run handed in, so a
// story is just a hand-written run — no stores, no clock.
const meta: Meta<typeof RunResult> = {
    title: "Features/RunResult",
    component: RunResult,
};
export default meta;

type Story = StoryObj<typeof RunResult>;

// A tidy single-hand run: near-on-time notes with one slip.
const singleHand: RunNote[] = Array.from({ length: 12 }, (_, i) => ({
    targetMs: i * 400,
    playedMs: i * 400 + [0, 12, -8, 5, -15, 20, 0, 10, -5, 8, -12, 4][i]!,
    wrongBefore: i === 5 ? 1 : 0,
}));

// A two-hand run where the left hand drags well behind the right, so the
// lagging-hand verdict names it.
const twoHands: RunNote[] = Array.from({ length: 16 }, (_, i) => {
    const left = i % 2 === 1;
    const beat = Math.floor(i / 2) * 500;
    return {
        targetMs: beat + (left ? 250 : 0),
        playedMs: left ? beat + 250 + Math.floor(i / 2) * 260 + 120 : beat + 10,
        wrongBefore: left && i > 8 ? 1 : 0,
        staves: [left ? 1 : 0],
    };
});

const goodGrade: Grade = {
    accuracy: 96,
    timing: 88,
    flow: 92,
    dynamics: null,
    score: 91,
    letter: "A",
};

const mixedGrade: Grade = {
    accuracy: 82,
    timing: 61,
    flow: 70,
    dynamics: 74,
    score: 71,
    letter: "C",
};

const goodGrid: Grid = [["best", "best", "good", "best", "good", "best"]];

const mixedGrid: Grid = [
    ["best", "good", "good", "best", "good", "good"],
    ["ok", "weak", "ok", "weak", "weak", "none"],
];

export const CleanRun: Story = {
    args: {
        grade: goodGrade,
        notes: singleHand,
        tolerance: 1,
        grid: goodGrid,
        tempoCurve: null,
        tempoScale: 1,
        title: "Ode to Joy",
        runSaved: "idle",
        onSaveTake: () => {},
    },
};

export const TwoHandDaily: Story = {
    args: {
        grade: mixedGrade,
        notes: twoHands,
        tolerance: 1,
        grid: mixedGrid,
        tempoCurve: {
            points: Array.from({ length: 14 }, (_, i) => ({
                index: i + 1,
                bpm: 96 - (i > 6 && i < 10 ? 24 : 0) + (i % 3) * 4,
            })),
            median: 98,
            hotspots: [{ startIndex: 7, endIndex: 9 }],
        },
        tempoScale: 1,
        daily: 42,
        title: "Minuet in G",
        runSaved: "saved",
        onSaveTake: () => {},
    },
};

export const SaveFailed: Story = {
    args: {
        grade: goodGrade,
        notes: singleHand,
        tolerance: 1,
        grid: goodGrid,
        tempoCurve: null,
        tempoScale: 1,
        title: "Ode to Joy",
        runSaved: "failed",
        onSaveTake: () => {},
    },
};

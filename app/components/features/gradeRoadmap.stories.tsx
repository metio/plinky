// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { markLearned } from "../../../core/mastery";
import type { GradedMastery } from "../../lib/gradeProgress";
import { GradeRoadmap } from "./gradeRoadmap";

const meta: Meta<typeof GradeRoadmap> = {
    title: "Features/GradeRoadmap",
    component: GradeRoadmap,
    decorators: [
        (Story) => (
            <div className="max-w-2xl">
                <Story />
            </div>
        ),
    ],
    // A pinned instant: freshness is measured against it, so a live clock would
    // move every row's due count between runs.
    args: { mode: "gentle", now: Date.UTC(2026, 2, 1) },
};
export default meta;

type Story = StoryObj<typeof GradeRoadmap>;

// Learned pieces spread across the lower grades, all mastered at the same pinned
// instant so nothing here depends on when the story runs.
const learned = (grade: number, count: number, at: number): GradedMastery[] =>
    Array.from({ length: count }, (_, index) => ({
        id: `g${grade}-${index}`,
        title: `Piece ${index + 1}`,
        grade,
        cost: 10 + index,
        kind: "piece" as const,
        mastery: markLearned(null, at),
    }));

const LONG_AGO = Date.UTC(2025, 10, 1);
const RECENTLY = Date.UTC(2026, 1, 20);

// A fresh device: eight rows, every one of them pressable from the first day.
// Being able to open Grade 8 and find four hundred pieces you may play says what
// no sentence can.
export const Fresh: Story = { args: { items: [], level: 0 } };

// Part way up, with stars earned below the current grade and refreshes fallen
// due in the oldest one.
export const Progressing: Story = {
    args: {
        items: [
            ...learned(1, 12, LONG_AGO),
            ...learned(2, 6, LONG_AGO),
            ...learned(3, 2, RECENTLY),
        ],
        level: 3,
    },
};

// The competitive decay counts a piece only while it is fresh, so the same
// history reads as fewer mastered and more due.
export const Competitive: Story = {
    args: {
        items: [...learned(1, 12, LONG_AGO), ...learned(2, 6, LONG_AGO)],
        level: 2,
        mode: "competitive",
    },
};

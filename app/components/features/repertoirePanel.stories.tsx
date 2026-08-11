// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { type Mastery, normalizeMastery } from "../../../core/mastery";
import { memoryStore } from "../../adapters/memoryStore";
import { ServicesProvider } from "../../contexts/services";
import type { GradedMastery } from "../../lib/gradeProgress";
import { createMasteryStore } from "../../stores/masteryStore";
import { RepertoirePanel } from "./repertoirePanel";

// The panel is a calendar as much as a list, so "today" is pinned: a story drawn
// from the wall clock would count down a day at a time and fail its baseline on a
// date change rather than on a visual one.
const NOW = new Date("2026-06-23T12:00:00");
const DAY_MS = 86_400_000;

function item(id: string, title: string, mastery: Partial<Mastery>): GradedMastery {
    return { id, title, grade: 3, cost: 12, kind: "piece", mastery: normalizeMastery(mastery) };
}

const ITEMS: GradedMastery[] = [
    item("exam", "Prelude in C", { bestScore: 71, deadline: "2026-06-30" }),
    item("recital", "Gymnopédie no. 1", {
        learned: true,
        intervalDays: 14,
        reviewAt: NOW.getTime() + 9 * DAY_MS,
        deadline: "2026-07-18",
    }),
    item("rusty", "Minuet in G", {
        learned: true,
        intervalDays: 4,
        reviewAt: NOW.getTime() - 20 * DAY_MS,
    }),
    item("new", "Für Elise", { bestScore: 44 }),
    item("kept", "Twinkle, Twinkle", {
        learned: true,
        intervalDays: 90,
        reviewAt: NOW.getTime() + 60 * DAY_MS,
    }),
];

function withMastery(items: GradedMastery[]) {
    const store = memoryStore();
    const mastery = createMasteryStore(store);
    for (const one of items) {
        mastery.save(one.id, one.mastery);
    }
    return { store, mastery };
}

const meta: Meta<typeof RepertoirePanel> = {
    title: "Features/RepertoirePanel",
    component: RepertoirePanel,
};
export default meta;

type Story = StoryObj<typeof RepertoirePanel>;

export const InProgress: Story = {
    render: function Render() {
        return (
            <ServicesProvider services={withMastery(ITEMS)}>
                <RepertoirePanel items={ITEMS} now={NOW} />
            </ServicesProvider>
        );
    },
};

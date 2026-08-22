// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import type { PracticeLog, PracticeSession } from "../../../core/practiceSession";
import { memoryStore } from "../../adapters/memoryStore";
import { ServicesProvider } from "../../contexts/services";
import { createPracticeLogStore } from "../../stores/practiceLogStore";
import { PracticeBalance } from "./practiceBalance";

// "Last played" is measured against a clock, so the clock is pinned: a story drawn from
// the wall one would say a different number of days every morning and its baseline would
// fail on a date change rather than on a visual one.
const NOW = Date.UTC(2026, 5, 23, 12);
const DAY = 86_400_000;

const TITLES: Record<string, string> = {
    bach: "Prelude in C",
    satie: "Gymnopédie No. 1",
    grieg: "Arietta",
    schumann: "Wild Rider",
    clementi: "Sonatina in C, I",
};

const session = (daysAgo: number, minutes: number, pieces: string[]): PracticeSession => ({
    start: NOW - daysAgo * DAY,
    end: NOW - daysAgo * DAY + minutes * 60_000,
    activeMs: minutes * 60_000,
    notes: minutes * 40,
    pieces,
    manual: false,
    mood: null,
    label: "",
});

// A rotation with a real shape: two pieces carrying most of the time, one shared sitting,
// and one that has quietly dropped out of the week.
const LOG: PracticeLog = [
    session(0, 25, ["bach"]),
    session(1, 40, ["satie"]),
    session(2, 30, ["bach", "grieg"]),
    session(4, 35, ["satie"]),
    session(6, 20, ["schumann"]),
    session(19, 45, ["clementi"]),
];

function withLog(log: PracticeLog) {
    const store = memoryStore();
    store.set("plinky:practice-log", JSON.stringify(log));
    return { store, practiceLog: createPracticeLogStore(store) };
}

const meta: Meta<typeof PracticeBalance> = {
    title: "Features/PracticeBalance",
    component: PracticeBalance,
};
export default meta;

type Story = StoryObj<typeof PracticeBalance>;

export const ARotation: Story = {
    render: function Render() {
        return (
            <ServicesProvider services={withLog(LOG)}>
                <PracticeBalance now={NOW} pieceTitle={(id) => TITLES[id] ?? id} />
            </ServicesProvider>
        );
    },
};

// One piece and nothing to compare it against: the bar is full width because it is the
// busiest, which is the honest drawing of a repertoire of one.
export const OnePiece: Story = {
    render: function Render() {
        return (
            <ServicesProvider services={withLog([session(0, 20, ["bach"])])}>
                <PracticeBalance now={NOW} pieceTitle={(id) => TITLES[id] ?? id} />
            </ServicesProvider>
        );
    },
};

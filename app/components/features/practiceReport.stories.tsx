// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { shiftDay } from "../../../core/dateKey";
import { addManualSession, type PracticeLog } from "../../../core/practiceSession";
import { memoryStore } from "../../adapters/memoryStore";
import { ServicesProvider } from "../../contexts/services";
import { createPracticeLogStore } from "../../stores/practiceLogStore";
import { PracticeReport } from "./practiceReport";

// The panel is a calendar, so both the log and "today" are pinned: a story drawn
// from the wall clock would shift its grid every day and its baseline would fail
// on a date change rather than on a visual one.
const TODAY = "2026-06-23";
const NOW = new Date(`${TODAY}T12:00:00`);

// A month of practice with the shape a real one has — busier some weeks, absent
// others, one hand-logged sitting among the measured ones.
const MINUTES_BY_DAYS_AGO: Record<number, number> = {
    0: 35,
    1: 20,
    2: 55,
    4: 15,
    5: 40,
    8: 25,
    9: 30,
    11: 45,
    12: 10,
    15: 60,
    16: 20,
    18: 30,
    22: 25,
    23: 50,
};

function seededLog(): PracticeLog {
    return Object.entries(MINUTES_BY_DAYS_AGO).reduce<PracticeLog>(
        (log, [daysAgo, minutes]) =>
            addManualSession(log, {
                date: shiftDay(TODAY, -Number(daysAgo)),
                minutes,
                mood: Number(daysAgo) === 2 ? "breakthrough" : null,
                label: Number(daysAgo) === 2 ? "Left hand finally landed" : "",
            }),
        [],
    );
}

function withLog(log: PracticeLog) {
    const store = memoryStore();
    store.set("plinky:practice-log", JSON.stringify(log));
    return { store, practiceLog: createPracticeLogStore(store) };
}

const meta: Meta<typeof PracticeReport> = {
    title: "Features/PracticeReport",
    component: PracticeReport,
};
export default meta;

type Story = StoryObj<typeof PracticeReport>;

export const AMonth: Story = {
    render: function Render() {
        return (
            <ServicesProvider services={withLog(seededLog())}>
                <PracticeReport now={NOW} />
            </ServicesProvider>
        );
    },
};

// Nothing recorded yet: the panel says so and offers a way in, rather than drawing
// an empty grid of zeros that would read as a reproach.
export const Empty: Story = {
    render: function Render() {
        return (
            <ServicesProvider services={withLog([])}>
                <PracticeReport now={NOW} />
            </ServicesProvider>
        );
    },
};

// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import type { LoggedError } from "../../../core/errorLog";
import { memoryStore } from "../../adapters/memoryStore";
import { ServicesProvider } from "../../contexts/services";
import { RecentProblems } from "./recentProblems";

// The faults come from the injected store, so a fixed log renders the same panel every
// time. The timestamps are pinned for the same reason: a live clock would rewrite the
// baseline on every run.
const meta: Meta<typeof RecentProblems> = {
    title: "Features/RecentProblems",
    component: RecentProblems,
};
export default meta;

type Story = StoryObj<typeof RecentProblems>;

const AT = Date.UTC(2026, 7, 27, 9, 15);

function seeded(faults: LoggedError[]) {
    return memoryStore({ "plinky:errors": JSON.stringify(faults) });
}

function panel(faults: LoggedError[]) {
    return (
        <ServicesProvider services={{ store: seeded(faults) }}>
            <RecentProblems />
        </ServicesProvider>
    );
}

// One fault, the ordinary case: a promise nobody caught while a piece was open.
export const OneFault: Story = {
    render: () =>
        panel([
            {
                at: AT,
                message:
                    "Unhandled rejection: TypeError: Failed to fetch at loadScore (score-B2f9.js:1:8421)",
                where: "/en/play/quWc4lVh4cvr/",
                count: 1,
            },
        ]),
};

// A fault that keeps happening is counted rather than repeated, so the panel says how
// bad it is instead of filling with copies of it.
export const Repeated: Story = {
    render: () =>
        panel([
            {
                at: AT,
                message: "Unhandled rejection: RangeError: Maximum call stack size exceeded",
                where: "/en/compose/",
                count: 148,
            },
            {
                at: AT - 86_400_000,
                message: "Script error.",
                where: "/en/",
                count: 2,
            },
        ]),
};

// Nothing has gone wrong, which is the ordinary case: the panel is absent rather than
// reporting a reassuring zero.
export const Quiet: Story = {
    render: () => panel([]),
};

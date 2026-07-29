// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { memoryStore } from "../../adapters/memoryStore";
import { ServicesProvider } from "../../contexts/services";
import { SlowNotes } from "./slowNotes";

// Seeded through the store the section reads, so the bars are the same length in
// every screenshot rather than drifting with whatever was played last.
const stats = {
    "60": { plays: 12, wrongs: 1, totalMs: 3600 },
    "65": { plays: 9, wrongs: 4, totalMs: 12600 },
    "71": { plays: 8, wrongs: 2, totalMs: 8800 },
    "77": { plays: 7, wrongs: 6, totalMs: 14700 },
};

const meta: Meta<typeof SlowNotes> = {
    title: "Features/SlowNotes",
    component: SlowNotes,
};
export default meta;

export const Default: StoryObj<typeof SlowNotes> = {
    render: () => (
        <ServicesProvider
            services={{ store: memoryStore({ "plinky:notestats": JSON.stringify(stats) }) }}
        >
            <SlowNotes />
        </ServicesProvider>
    ),
};

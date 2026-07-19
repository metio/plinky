// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Prefs } from "../../../core/prefs";
import { levelAids } from "../../../core/readingLevel";
import { memoryStore } from "../../adapters/memoryStore";
import { ServicesProvider } from "../../contexts/services";
import { createPrefsStore } from "../../stores/prefsStore";
import { ReadingLevel } from "./readingLevel";

// The control reads its level from the injected prefs store, so each state is just
// a differently seeded set of reading aids.
const meta: Meta<typeof ReadingLevel> = {
    title: "Features/ReadingLevel",
    component: ReadingLevel,
};
export default meta;

type Story = StoryObj<typeof ReadingLevel>;

function seeded(change: Partial<Prefs>) {
    const store = memoryStore();
    const prefs = createPrefsStore(store);
    prefs.save({ ...prefs.load(), ...change });
    return (
        <ServicesProvider services={{ store }}>
            <ReadingLevel />
        </ServicesProvider>
    );
}

// The friendliest tier — every aid on — reads as the selected segment.
export const NewStarter: Story = { render: () => seeded(levelAids("starter")) };

// The bare-staff tier at the other end of the ladder.
export const SightReader: Story = { render: () => seeded(levelAids("sightReader")) };

// A hand-tuned mix matches no level: no segment is selected and the help line
// switches to the custom message.
export const Custom: Story = {
    render: () => seeded({ ...levelAids("starter"), highway: false }),
};

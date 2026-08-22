// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Composition } from "../../../core/composition";
import type { Take } from "../../../core/takes";
import { ServicesProvider } from "../../contexts/services";
import { TakesPanel } from "./takesPanel";

// A deterministic exporter that only answers the support probe, so the Save
// video button renders in the shot without any real encoding.
const videoAvailable = {
    supported: async () => true,
    export: async () => new Blob(),
};

const composition: Composition = {
    notes: [{ pitch: 60, startMs: 0, durationMs: 200, velocity: 90 }],
    tempo: 120,
    beatsPerBar: 4,
};

// Takes are built inside each story's render, so createdAt matches the panel's
// own render-time clock and the age always rasterizes as "now" — no live date
// can drift into the baseline.
const take = (id: string, overrides: Partial<Take> = {}): Take => ({
    id,
    createdAt: Date.now(),
    letter: "B",
    complete: true,
    metrics: null,
    composition,
    ...overrides,
});

const meta: Meta<typeof TakesPanel> = {
    title: "Features/TakesPanel",
    component: TakesPanel,
    decorators: [
        (Story) => (
            <ServicesProvider services={{ video: videoAvailable }}>
                <div className="max-w-md p-4">
                    <Story />
                </div>
            </ServicesProvider>
        ),
    ],
    args: {
        id: "menuet",
        title: "Menuet",
        credit: "Menuet · J. S. Bach · CC0",
        activeReplayId: null,
        playing: false,
        onReplay: () => {},
        onStop: () => {},
        onDelete: () => {},
    },
};
export default meta;

type Story = StoryObj<typeof TakesPanel>;

// The narrow-drawer case that motivated the two-line row: a graded run with
// metrics plus every action — replay, delete, race, both downloads, and Save
// video — all fitting a phone-width drawer without overflowing.
export const FullRow: Story = {
    render: (args) => (
        <TakesPanel
            {...args}
            takes={[
                take("t1", {
                    letter: "A",
                    metrics: {
                        accuracy: 98,
                        timing: 91,
                        flow: 95,
                        dynamics: null,
                        expression: null,
                        score: 95,
                        letter: "A",
                    },
                }),
                take("t2", { letter: "C", complete: false }),
            ]}
        />
    ),
    args: { takes: [] },
};

// A run of a piece that MARKS its dynamics and expression, played on an instrument that can
// report them — so the take carries all five readings. The list used to name three of them
// by hand and drop these two, though the take had stored them all along; this story is what
// makes that visible in review.
export const EveryReading: Story = {
    render: (args) => (
        <TakesPanel
            {...args}
            takes={[
                take("t1", {
                    letter: "A",
                    metrics: {
                        accuracy: 98,
                        timing: 91,
                        flow: 95,
                        dynamics: 88,
                        expression: 74,
                        score: 95,
                        letter: "A",
                    },
                }),
            ]}
        />
    ),
    args: { takes: [] },
};

export const Empty: Story = {
    args: { takes: [] },
};

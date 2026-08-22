// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { ComposeSettings } from "./composeSettings";

const meta: Meta<typeof ComposeSettings> = {
    title: "Features/ComposeSettings",
    component: ComposeSettings,
    args: {
        title: "Morning sketch",
        onTitle: () => {},
        tempo: 120,
        onTempo: () => {},
        beatsPerBar: 4,
        onBeatsPerBar: () => {},
        quantizeOn: true,
        onQuantize: () => {},
        metronomeOn: false,
        onMetronome: () => {},
    },
};
export default meta;

type Story = StoryObj<typeof ComposeSettings>;

// The row as it sits above a take: title, the tempo and meter everything is
// measured against, and the two toggles.
export const Default: Story = {};

// Step entry writes exact lengths, so there is nothing to tidy — the quantize
// switch is held off rather than left to promise something it would not do.
export const QuantizeLocked: Story = { args: { quantizeLocked: true } };

// A three-four take with the metronome on, which is the other meter the staff
// and the exports have to agree about.
export const ThreeFour: Story = { args: { beatsPerBar: 3, tempo: 84, metronomeOn: true } };

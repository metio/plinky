// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { ComposeControls } from "./composeControls";

const meta: Meta<typeof ComposeControls> = {
    title: "Features/ComposeControls",
    component: ComposeControls,
    args: {
        empty: true,
        playing: false,
        countingIn: false,
        checkpoint: null,
        onCountIn: () => {},
        onPlay: () => {},
        onStop: () => {},
        onSetCheckpoint: () => {},
        onResetToCheckpoint: () => {},
        onClear: () => {},
    },
};
export default meta;

type Story = StoryObj<typeof ComposeControls>;

// Nothing recorded yet: everything that acts on a take is out of reach, and only
// the count-in is live.
export const Empty: Story = {};

// A take in progress with a checkpoint set, which is when the reset button stops
// being a dead label and names the bar it would return to.
export const Recorded: Story = { args: { empty: false, checkpoint: 12 } };

// While the count-in clicks, both buttons are ways out — the armed primary
// cancels and the transport reads Stop.
export const CountingIn: Story = { args: { empty: false, countingIn: true } };

// Playing back what was recorded.
export const Playing: Story = { args: { empty: false, playing: true, checkpoint: 4 } };

// Step entry holds the count-in: there is nothing to be in time with when the
// notes are written rather than played, so the disabled primary says why.
export const Stepping: Story = { args: { empty: false, stepping: true } };

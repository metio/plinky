// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { MidiDebugPanel } from "./midiDebugPanel";

const meta: Meta<typeof MidiDebugPanel> = {
    title: "Components/MidiDebugPanel",
    component: MidiDebugPanel,
};
export default meta;

export const Default: StoryObj<typeof MidiDebugPanel> = {};

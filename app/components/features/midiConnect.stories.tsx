// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { MidiConnect } from "./midiConnect";

const meta: Meta<typeof MidiConnect> = {
    title: "Components/MidiConnect",
    component: MidiConnect,
};
export default meta;

export const Default: StoryObj<typeof MidiConnect> = {};

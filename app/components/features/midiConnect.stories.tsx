// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { MidiConnect } from "./midiConnect";

const meta: Meta<typeof MidiConnect> = {
    title: "Components/MidiConnect",
    component: MidiConnect,
};
export default meta;

export const Default: StoryObj<typeof MidiConnect> = {};

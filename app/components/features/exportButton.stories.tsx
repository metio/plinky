// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { ExportButton } from "./exportButton";

// A single icon button; the MusicXML is only parsed when clicked, so the story
// hands in a placeholder score.
const meta: Meta<typeof ExportButton> = {
    title: "Features/ExportButton",
    component: ExportButton,
};
export default meta;

type Story = StoryObj<typeof ExportButton>;

export const Default: Story = {
    args: {
        xml: "<score-partwise/>",
        title: "Ode to Joy",
    },
};

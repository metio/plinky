// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { ExportMenu } from "./exportMenu";

// The MusicXML is only parsed on a click, so the story hands in a placeholder
// score; the open state shows the explained options.
const meta: Meta<typeof ExportMenu> = {
    title: "Features/ExportMenu",
    component: ExportMenu,
    // The panel drops below and to the left of the trigger; give it room so
    // the screenshot holds the whole menu.
    decorators: [
        (Story) => (
            <div style={{ display: "flex", justifyContent: "flex-end", minHeight: 320 }}>
                <Story />
            </div>
        ),
    ],
};
export default meta;

type Story = StoryObj<typeof ExportMenu>;

export const Closed: Story = {
    args: {
        xml: "<score-partwise/>",
        title: "Ode to Joy",
    },
};

export const Open: Story = {
    args: {
        xml: "<score-partwise/>",
        title: "Ode to Joy",
        defaultOpen: true,
    },
};

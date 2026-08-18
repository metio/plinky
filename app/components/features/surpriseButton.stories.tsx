// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { SurpriseButton } from "./surpriseButton";

const meta: Meta<typeof SurpriseButton> = {
    title: "Features/SurpriseButton",
    component: SurpriseButton,
    decorators: [
        (Story) => (
            <div className="max-w-xs">
                <Story />
            </div>
        ),
    ],
};
export default meta;

type Story = StoryObj<typeof SurpriseButton>;

// One tap into a piece at the edge of what the player can do — the whole width
// of its column, because it is an invitation rather than a control.
export const Default: Story = { args: { onClick: () => {} } };

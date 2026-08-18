// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { PracticeMethods } from "./practiceMethods";

const meta: Meta<typeof PracticeMethods> = {
    title: "Features/PracticeMethods",
    component: PracticeMethods,
    decorators: [
        (Story) => (
            <div className="max-w-2xl">
                <Story />
            </div>
        ),
    ],
};
export default meta;

type Story = StoryObj<typeof PracticeMethods>;

// Six ways to practise: what each is, how long a go takes, and why it works.
// Nothing here carries an action — the reading is the point, and the practice is
// wherever the player already was.
export const All: Story = {};

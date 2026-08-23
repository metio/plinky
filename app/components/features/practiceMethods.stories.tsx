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

// Six ways to practise: why each one works, what Plinky gives you to do it with, and a
// button that opens a piece with the method already set up on it. The reason leads,
// because somebody who does not know why looping two bars beats replaying the piece will
// not reach for the loop.
export const All: Story = {};

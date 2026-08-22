// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { ActivityStats, StandingKey, YouStanding } from "./youStanding";

const meta: Meta<typeof YouStanding> = { title: "Features/YouStanding", component: YouStanding };
export default meta;

type Story = StoryObj<typeof YouStanding>;

// Before anything has been played, and once a grade has been reached.
export const Standing: Story = {
    render: () => (
        <div className="flex flex-col gap-4">
            <YouStanding level={0} skill={0} competitive={false} />
            <YouStanding level={3} skill={1240} competitive={false} />
        </div>
    ),
};

// With the opt-in competitive decay on, which is the only thing the crossed
// swords mean.
export const Competitive: Story = {
    render: () => <YouStanding level={5} skill={1810} competitive={true} />,
};

// What the two numbers above actually mean, spelled out on the page rather than
// hidden in a tooltip nobody on a touch screen can open.
export const Key: Story = { render: () => <StandingKey /> };

// The two lifetime tiles under the standing card.
export const Activity: Story = {
    render: () => (
        <div className="flex flex-col gap-4">
            <ActivityStats daysPracticed={0} totalNotes={0} />
            <ActivityStats daysPracticed={128} totalNotes={94210} />
        </div>
    ),
};

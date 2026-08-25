// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { ActivityStats, Standing, StandingKey } from "./standing";

const meta: Meta<typeof Standing> = { title: "Features/Standing", component: Standing };
export default meta;

type Story = StoryObj<typeof Standing>;

// Before anything has been played, and once a grade has been reached.
export const Levels: Story = {
    render: () => (
        <div className="flex flex-col gap-4">
            <Standing level={0} skill={0} competitive={false} />
            <Standing level={3} skill={1240} competitive={false} />
        </div>
    ),
};

// With the opt-in competitive decay on, which is the only thing the crossed
// swords mean.
export const Competitive: Story = {
    render: () => <Standing level={5} skill={1810} competitive={true} />,
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

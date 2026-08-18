// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { RefreshQueue } from "./refreshQueue";

// What is due for review, and the empty state that says nothing is. The empty one earns
// its story: "nothing to review" has to read as good news rather than as a gap, and that
// is a matter of how it looks.
const meta: Meta<typeof RefreshQueue> = {
    title: "Features/RefreshQueue",
    component: RefreshQueue,
    decorators: [
        (Story: () => ReactNode) => (
            <MemoryRouter>
                <div className="max-w-xl">{Story()}</div>
            </MemoryRouter>
        ),
    ],
};
export default meta;

type Story = StoryObj<typeof RefreshQueue>;

// A piece opens on /play and an ear round opens its drill on /ear, so the queue mixes
// both — and only a piece has an opening bar to show.
const DUE = [
    {
        id: "ode",
        title: "Ode to Joy",
        kind: "piece" as const,
        incipit: "G35q36q37q38q37q36q35q",
    },
    { id: "study", title: "Study in C", kind: "piece" as const, incipit: "G35q37q39q40q" },
    { id: "ear-3", title: "Intervals, level 3", kind: "ear" as const },
];

export const Due: Story = { args: { reviews: DUE } };

export const NothingDue: Story = { args: { reviews: [] } };

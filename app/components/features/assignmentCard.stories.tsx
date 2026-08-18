// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { trackSteps } from "../../../core/tracks";
import { AssignmentStepList } from "./assignmentCard";

// The ordered pieces of an assignment, each marked done, current or still to come. This
// is where an opening bar earns most: somebody else chose these pieces, and a column of
// titles says nothing about the music until you open every one.
const meta: Meta<typeof AssignmentStepList> = {
    title: "Features/AssignmentStepList",
    component: AssignmentStepList,
    decorators: [
        (Story: () => ReactNode) => (
            <MemoryRouter>
                <div className="max-w-xl">{Story()}</div>
            </MemoryRouter>
        ),
    ],
};
export default meta;

type Story = StoryObj<typeof AssignmentStepList>;

const TITLES: Record<string, string> = {
    ode: "Ode to Joy",
    minuet: "Minuet in G",
    gone: "A piece this device does not have",
};
const MARKS: Record<string, string> = {
    ode: "G35q36q37q38q37q36q35q",
    minuet: "G37q39q40q41q39q",
};

const args = {
    steps: trackSteps(["ode", "minuet", "gone"], (id) => id === "ode"),
    titleOf: (id: string) => TITLES[id] ?? id,
    isMissing: (id: string) => id === "gone",
    incipitOf: (id: string) => MARKS[id],
};

// One done, one current, one still to come — and one the device cannot resolve, which a
// teacher's list will contain whenever it names a piece the student has not got.
export const Mixed: Story = { args };

// Every step finished.
export const AllDone: Story = {
    args: { ...args, steps: trackSteps(["ode", "minuet"], () => true) },
};

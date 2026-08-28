// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { trackSteps } from "../../../core/tracks";
import { AssignmentCard, AssignmentStepList } from "./assignmentCard";
import { makeAssignment } from "../../../core/assignment";

// The ordered pieces of an assignment, each marked done, current or still to come. This
// is where an opening bar earns most: somebody else chose these pieces, and a column of
// titles says nothing about the music until you open every one.
const meta: Meta<typeof AssignmentStepList> = {
    title: "Features/AssignmentStepList",
    component: AssignmentStepList,
    decorators: [
        (Story) => (
            <div className="max-w-xl">
                <Story />
            </div>
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

// The card around the steps: name, progress and the two actions. Rendered here rather
// than under a meta of its own so the existing baselines keep their names.
//
// No due date on purpose — a deadline is read against today, and a story that renders
// differently tomorrow is not a baseline.
const card = {
    assignment: makeAssignment({
        id: "bach-inventions",
        name: "Bach — The two-part inventions",
        items: [{ id: "ode" }, { id: "minuet" }, { id: "gone" }],
    }),
    steps: args.steps,
    copiedShare: null,
    onShare: () => {},
    onDownload: () => {},
};

// A set the player keeps. Its work is what they came to see, so it stays open.
export const CardOpen: Story = {
    render: () => (
        <ul>
            <AssignmentCard {...card}>
                <AssignmentStepList {...args} />
            </AssignmentCard>
        </ul>
    ),
};

// A named work from the catalogue. There are two dozen of these, so the pieces fold away
// and the shelf stays something you can read down.
export const CardFolded: Story = {
    render: () => (
        <ul>
            <AssignmentCard {...card} foldSteps>
                <AssignmentStepList {...args} />
            </AssignmentCard>
        </ul>
    ),
};

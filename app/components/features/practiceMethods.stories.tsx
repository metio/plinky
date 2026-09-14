// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { type MethodId, METHODS } from "../../../core/practiceMethods";
import { MethodLeaf } from "./practiceMethods";

const meta: Meta<typeof MethodLeaf> = {
    title: "Features/MethodLeaf",
    component: MethodLeaf,
    decorators: [
        (Story) => (
            <div className="max-w-xl">
                <Story />
            </div>
        ),
    ],
};
export default meta;

type Story = StoryObj<typeof MethodLeaf>;

const leaf = (id: MethodId): Story => {
    const method = METHODS.find((candidate) => candidate.id === id);
    if (!method) {
        throw new Error(`no method ${id}`);
    }
    return { args: { id: `leaf-${id}`, method } };
};

// One way to practise, opened below the front page's keyboard: its drawing in the margin,
// why it works, what Plinky gives you to do it with, how long it takes, and the button. The
// reason leads, because somebody who does not know why looping two bars beats replaying the
// piece will not reach for the loop.
export const Loop: Story = leaf("chunking");

// A method that is not about one piece sends you to the review queue instead.
export const MixThemUp: Story = leaf("interleaving");

// A method that is a generated exercise opens it directly.
export const Chords: Story = leaf("chords");

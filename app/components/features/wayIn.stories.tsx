// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { GradeChip, WayIn } from "./scoreGrade";

// What a hard piece says about itself when there is a gentler reading of it. The line
// under the chip is the whole point: a grade on its own can only say no, and this is the
// piece admitting that its tune is easier than its filling. One story per reduction,
// because the wording is the visual variable — and one showing it beside the chip it sits
// under in a list row, which is where the two are read together.
const meta: Meta<typeof WayIn> = {
    title: "Features/WayIn",
    component: WayIn,
};
export default meta;

type Story = StoryObj<typeof WayIn>;

export const InnerNotesOut: Story = {
    args: { reach: { thinned: 4 } },
};

export const MelodyAndBass: Story = {
    args: { reach: { outlined: 3 } },
};

export const MelodyAlone: Story = {
    args: { reach: { melody: 1 } },
};

// Several reductions reach somewhere easier; only the easiest is offered, because a list
// row is answering "can I play this", not "how many ways are there".
export const OnlyTheEasiest: Story = {
    args: { reach: { thinned: 5, outlined: 3, melody: 1 } },
};

// A piece with nothing to take out renders nothing at all, so a row of easy pieces does
// not grow a blank line each.
export const NothingToTakeOut: Story = {
    args: { reach: {} },
};

export const UnderTheChip: Story = {
    render: () => (
        <span className="flex flex-col items-end gap-0.5">
            <GradeChip grade={6} />
            <WayIn reach={{ outlined: 4, melody: 2 }} className="whitespace-nowrap" />
        </span>
    ),
};

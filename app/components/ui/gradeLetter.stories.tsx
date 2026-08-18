// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Letter } from "../../../core/grade";
import { GradeLetter } from "./gradeLetter";

const meta: Meta<typeof GradeLetter> = { title: "UI/GradeLetter", component: GradeLetter };
export default meta;

type Story = StoryObj<typeof GradeLetter>;

const LETTERS: Letter[] = ["S", "A", "B", "C", "D", "E", "F"];

// All seven at once, which is the only way the scale can be read as a scale:
// each letter has to stay distinguishable from its neighbours in both themes.
export const Scale: Story = {
    render: () => (
        <div className="flex items-center gap-6">
            {LETTERS.map((letter) => (
                <GradeLetter key={letter} letter={letter} />
            ))}
        </div>
    ),
};

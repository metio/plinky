// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { EyeIcon, FingersIcon, MetronomeIcon } from "./icons";
import { ToggleIconButton } from "./toggleIconButton";

const meta: Meta<typeof ToggleIconButton> = {
    title: "UI/ToggleIconButton",
    component: ToggleIconButton,
};
export default meta;

type Story = StoryObj<typeof ToggleIconButton>;

// Pressed and unpressed next to each other: the accent colour is the whole
// signal, so the two have to be told apart at a glance in both themes.
export const States: Story = {
    render: () => (
        <div className="flex items-center gap-2">
            <ToggleIconButton pressed={false} label="Finger numbers" onClick={() => {}}>
                <FingersIcon className="h-5 w-5" />
            </ToggleIconButton>
            <ToggleIconButton pressed={true} label="Follow the note" onClick={() => {}}>
                <EyeIcon className="h-5 w-5" />
            </ToggleIconButton>
            <ToggleIconButton pressed={true} label="Metronome" onClick={() => {}}>
                <MetronomeIcon className="h-5 w-5" />
            </ToggleIconButton>
        </div>
    ),
};

// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { KEYBOARD_THEMES } from "../../../core/keyboardTheme";
import { ThemeSwatch } from "./keyboardThemePicker";

// The swatch previews on their own, so every skin's resting palette is a visual baseline
// (the full picker's lock state depends on the injected grade, so it is tested in jsdom).
const meta: Meta<typeof ThemeSwatch> = {
    title: "Features/KeyboardThemeSwatch",
    component: ThemeSwatch,
};
export default meta;

type Story = StoryObj<typeof ThemeSwatch>;

export const AllSkins: Story = {
    render: () => (
        <div className="flex gap-3 p-4">
            {KEYBOARD_THEMES.map((theme) => (
                <ThemeSwatch key={theme.id} theme={theme} />
            ))}
        </div>
    ),
};

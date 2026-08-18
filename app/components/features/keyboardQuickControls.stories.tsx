// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { KeyboardQuickControls } from "./keyboardQuickControls";

const meta: Meta<typeof KeyboardQuickControls> = {
    title: "Features/KeyboardQuickControls",
    component: KeyboardQuickControls,
    args: {
        hidden: false,
        onToggleHidden: () => {},
        noteLabels: "all",
        onNoteLabels: () => {},
        noteHints: "always",
        onNoteHints: () => {},
    },
};
export default meta;

type Story = StoryObj<typeof KeyboardQuickControls>;

// The cluster above the keys: a glyph for the naming, a glyph for how much the
// keyboard gives away, and the fold-away toggle.
export const Bar: Story = {};

// Folded away. The cycle buttons go with the keys — there is nothing to label —
// and the toggle stays as the way back.
export const Hidden: Story = { args: { hidden: true } };

// Solfège naming with the hint reduced to after-a-miss. Each glyph stands for
// the setting itself rather than describing it.
export const Solfege: Story = { args: { noteLabels: "solfege", noteHints: "miss" } };

// Naming off and hints off, which is what a confident reader leaves behind.
export const Bare: Story = { args: { noteLabels: "off", noteHints: "never" } };

// A free-play surface has no next note to hint, so it omits the pair and the
// cycle button stays off the bar altogether.
export const NoHints: Story = { args: { noteHints: undefined, onNoteHints: undefined } };

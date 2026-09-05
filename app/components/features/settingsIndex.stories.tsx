// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { SettingsIndex } from "./settingsIndex";

const meta = {
    title: "Features/SettingsIndex",
    component: SettingsIndex,
    args: {
        current: "sound",
        groups: [
            {
                label: "Your instrument",
                items: [
                    { anchor: "midi", title: "Connect MIDI" },
                    { anchor: "keys", title: "Computer keyboard" },
                    { anchor: "sound", title: "Sound" },
                ],
            },
            {
                label: "While you play",
                items: [
                    { anchor: "reading", title: "Reading" },
                    { anchor: "hand", title: "Finger position" },
                    { anchor: "metronome", title: "Metronome" },
                ],
            },
            {
                label: "This device",
                items: [
                    { anchor: "appearance", title: "Appearance" },
                    { anchor: "danger", title: "Danger zone" },
                ],
            },
        ],
    },
    decorators: [(Story) => <div className="w-56 p-4">{Story()}</div>],
} satisfies Meta<typeof SettingsIndex>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

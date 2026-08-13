// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { HubList } from "./hubList";
import { BookIcon, EarIcon, KeysIcon } from "./icons";

const meta: Meta<typeof HubList> = {
    title: "UI/HubList",
    component: HubList,
};
export default meta;

type Story = StoryObj<typeof HubList>;

// A hub's whole job is to say what each place is before you go there, so the story
// carries real blurbs rather than a row of bare labels.
export const Entries: Story = {
    args: {
        entries: [
            {
                to: "/basics",
                label: "Meet the keyboard",
                blurb: "Never played before? Six things, and you'll be playing notes on purpose. No piano needed — the keys below work fine.",
                Icon: KeysIcon,
            },
            {
                to: "/theory",
                label: "How the music works",
                blurb: "Eight short lessons on what a stave is actually telling you. Each one has something to play — read the paragraph, then hear it.",
                Icon: BookIcon,
            },
            {
                to: "/ear",
                label: "Ear training",
                blurb: "Away from the piano? Your ears can still practise — name the notes and the distances between them.",
                Icon: EarIcon,
            },
        ],
    },
};

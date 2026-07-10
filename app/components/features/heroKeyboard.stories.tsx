// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { memoryStore } from "../../adapters/memoryStore";
import { ServicesProvider } from "../../contexts/services";
import { HeroKeyboard } from "./heroKeyboard";

// The landing page's playable octave. Sound and key lighting happen only on a
// press, so the resting render is static; an in-memory store keeps the note
// labels at their default setting.
const meta: Meta<typeof HeroKeyboard> = {
    title: "Features/HeroKeyboard",
    component: HeroKeyboard,
};
export default meta;

type Story = StoryObj<typeof HeroKeyboard>;

export const Default: Story = {
    render: function Render() {
        return (
            <ServicesProvider services={{ store: memoryStore() }}>
                <HeroKeyboard />
            </ServicesProvider>
        );
    },
};

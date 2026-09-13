// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { memoryStore } from "../../adapters/memoryStore";
import { ServicesProvider } from "../../contexts/services";
import { HeroKeyboard } from "./heroKeyboard";

// The front page's playable octave, with a way to practise on each white key and the first
// key's method open below it, as the page arrives. Sound, lighting and opening another
// method happen only on a press, so the resting render is static; an in-memory store keeps
// the note labels at their default setting.
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

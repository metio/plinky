// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { memoryStore } from "../../adapters/memoryStore";
import { ServicesProvider } from "../../contexts/services";
import { createHintsStore } from "../../stores/hintsStore";
import { CoachMark } from "./coachMark";

// A fresh in-memory hints store has seen nothing, so the mark shows; dismissing
// it writes through the injected store and it disappears for good.
const meta: Meta<typeof CoachMark> = {
    title: "Features/CoachMark",
    component: CoachMark,
};
export default meta;

type Story = StoryObj<typeof CoachMark>;

export const Unseen: Story = {
    render: function Render() {
        return (
            <ServicesProvider services={{ hints: createHintsStore(memoryStore()) }}>
                <CoachMark id="story-hint">
                    Tip: switch between Play, Ear and Fingering with the tabs above — the open piece
                    follows you.
                </CoachMark>
            </ServicesProvider>
        );
    },
};

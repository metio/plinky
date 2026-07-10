// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { markLearned, setBacklog } from "../../../core/mastery";
import { memoryStore } from "../../adapters/memoryStore";
import { ServicesProvider } from "../../contexts/services";
import { createMasteryStore } from "../../stores/masteryStore";
import { BacklogButton } from "./backlogButton";

// The button renders only for a learned piece, so both stories seed the injected
// mastery store — with a pinned timestamp, since only the flags reach the render.
const meta: Meta<typeof BacklogButton> = {
    title: "Features/BacklogButton",
    component: BacklogButton,
};
export default meta;

type Story = StoryObj<typeof BacklogButton>;

export const Active: Story = {
    render: function Render() {
        const mastery = createMasteryStore(memoryStore());
        mastery.save("story-piece", markLearned(null, 0));
        return (
            <ServicesProvider services={{ mastery }}>
                <BacklogButton id="story-piece" />
            </ServicesProvider>
        );
    },
};

export const Shelved: Story = {
    render: function Render() {
        const mastery = createMasteryStore(memoryStore());
        mastery.save("story-piece", setBacklog(markLearned(null, 0), true, 0));
        return (
            <ServicesProvider services={{ mastery }}>
                <BacklogButton id="story-piece" />
            </ServicesProvider>
        );
    },
};

// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { markLearned } from "../../../core/mastery";
import { memoryStore } from "../../adapters/memoryStore";
import { ServicesProvider } from "../../contexts/services";
import { createMasteryStore } from "../../stores/masteryStore";
import { MarkLearnedButton } from "./markLearnedButton";

// A feature component running entirely on injected fakes: the story hands it a
// mastery store over an in-memory backing, so each state is just differently
// seeded data — no browser storage, no setup beyond the provider. Clicking the
// button writes through the injected store and the component hides itself, the
// same single-source-of-truth round trip the app performs.
const meta: Meta<typeof MarkLearnedButton> = {
    title: "Features/MarkLearnedButton",
    component: MarkLearnedButton,
};
export default meta;

type Story = StoryObj<typeof MarkLearnedButton>;

export const Unlearned: Story = {
    render: function Render() {
        const mastery = createMasteryStore(memoryStore());
        return (
            <ServicesProvider services={{ mastery }}>
                <MarkLearnedButton id="story-piece" />
            </ServicesProvider>
        );
    },
};

export const AlreadyLearned: Story = {
    render: function Render() {
        const mastery = createMasteryStore(memoryStore());
        mastery.save("story-piece", markLearned(null, 0));
        return (
            <ServicesProvider services={{ mastery }}>
                <p className="text-sm text-gray-500">
                    A learned piece renders no button — the control removes itself:
                </p>
                <MarkLearnedButton id="story-piece" />
            </ServicesProvider>
        );
    },
};

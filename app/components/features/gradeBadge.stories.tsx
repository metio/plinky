// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { memoryStore } from "../../adapters/memoryStore";
import { ServicesProvider } from "../../contexts/services";
import { createMasteryStore } from "../../stores/masteryStore";
import { createPrefsStore } from "../../stores/prefsStore";
import { GradeBadge } from "./gradeBadge";

// The badge derives grade and skill from injected mastery + prefs stores. The
// stories keep mastery empty — an untouched store resolves to Grade 0 / ⚡0
// without touching the catalogue or the clock, so the frame is deterministic.
const meta: Meta<typeof GradeBadge> = {
    title: "Features/GradeBadge",
    component: GradeBadge,
};
export default meta;

type Story = StoryObj<typeof GradeBadge>;

export const FreshDevice: Story = {
    render: function Render() {
        const store = memoryStore();
        return (
            <ServicesProvider
                services={{ mastery: createMasteryStore(store), prefs: createPrefsStore(store) }}
            >
                <GradeBadge />
            </ServicesProvider>
        );
    },
};

export const CompetitiveMode: Story = {
    render: function Render() {
        const store = memoryStore();
        const prefs = createPrefsStore(store);
        prefs.save({ ...prefs.load(), decayMode: "competitive" });
        return (
            <ServicesProvider services={{ mastery: createMasteryStore(store), prefs }}>
                <GradeBadge />
            </ServicesProvider>
        );
    },
};

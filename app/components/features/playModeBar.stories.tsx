// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { memoryStore } from "../../adapters/memoryStore";
import { ServicesProvider } from "../../contexts/services";
import { createHintsStore } from "../../stores/hintsStore";
import { createOnboardingStore } from "../../stores/onboardingStore";
import { PlayModeBar, type PlayMode } from "./playModeBar";

// The bar runs on injected onboarding + hints stores: whether the coach marks show
// is just how the hints store is seeded, and switching tabs records discovery
// through the onboarding store.
const meta: Meta<typeof PlayModeBar> = {
    title: "Features/PlayModeBar",
    component: PlayModeBar,
};
export default meta;

type Story = StoryObj<typeof PlayModeBar>;

function Harness({ initial, seenHints }: { initial: PlayMode; seenHints: string[] }) {
    const store = memoryStore();
    const hints = createHintsStore(store);
    for (const id of seenHints) {
        hints.markSeen(id);
    }
    const [mode, setMode] = useState(initial);
    return (
        <ServicesProvider services={{ hints, onboarding: createOnboardingStore(store) }}>
            <div className="px-6">
                <PlayModeBar mode={mode} onChange={setMode} />
            </div>
        </ServicesProvider>
    );
}

export const FirstVisit: Story = {
    render: function Render() {
        return <Harness initial="play" seenHints={[]} />;
    },
};

export const EarMode: Story = {
    render: function Render() {
        return <Harness initial="ear" seenHints={[]} />;
    },
};

export const CoachMarksDismissed: Story = {
    render: function Render() {
        return <Harness initial="play" seenHints={["play-modes", "practice-loop"]} />;
    },
};

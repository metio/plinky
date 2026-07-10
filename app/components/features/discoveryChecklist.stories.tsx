// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { markLearned } from "../../../core/mastery";
import { memoryStore } from "../../adapters/memoryStore";
import { ServicesProvider } from "../../contexts/services";
import { createDailyStore } from "../../stores/dailyStore";
import { createMasteryStore } from "../../stores/masteryStore";
import { createOnboardingStore } from "../../stores/onboardingStore";
import { createPrefsStore } from "../../stores/prefsStore";
import { DiscoveryChecklist } from "./discoveryChecklist";

// The checklist reads every discovery step through the injected stores, so each
// story is one differently seeded in-memory world: seeding writes land in the
// shared backing store the provider derives its stores from.
const meta: Meta<typeof DiscoveryChecklist> = {
    title: "Features/DiscoveryChecklist",
    component: DiscoveryChecklist,
};
export default meta;

type Story = StoryObj<typeof DiscoveryChecklist>;

export const Fresh: Story = {
    render: function Render() {
        return (
            <ServicesProvider services={{ store: memoryStore() }}>
                <DiscoveryChecklist />
            </ServicesProvider>
        );
    },
};

export const PartlyDone: Story = {
    render: function Render() {
        const store = memoryStore();
        const prefs = createPrefsStore(store);
        prefs.save({ ...prefs.load(), handSpan: { left: 19, right: 20 } });
        createOnboardingStore(store).markDiscovered("earTried");
        createDailyStore(store).recordDone(12);
        createMasteryStore(store).save("story-piece", markLearned(null, 0));
        return (
            <ServicesProvider services={{ store }}>
                <DiscoveryChecklist />
            </ServicesProvider>
        );
    },
};

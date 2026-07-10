// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { DEFAULT_KEY_MAP, rebind } from "../../../core/keyMap";
import { memoryStore } from "../../adapters/memoryStore";
import { ServicesProvider } from "../../contexts/services";
import { createPrefsStore } from "../../stores/prefsStore";
import { KeyMapping } from "./keyMapping";

// The editor reads its layout from the injected prefs store, so a custom layout
// is just a differently seeded key map.
const meta: Meta<typeof KeyMapping> = {
    title: "Features/KeyMapping",
    component: KeyMapping,
};
export default meta;

type Story = StoryObj<typeof KeyMapping>;

export const DefaultLayout: Story = {
    render: function Render() {
        return (
            <ServicesProvider services={{ store: memoryStore() }}>
                <KeyMapping />
            </ServicesProvider>
        );
    },
};

export const CustomBinding: Story = {
    render: function Render() {
        const store = memoryStore();
        const prefs = createPrefsStore(store);
        prefs.save({ ...prefs.load(), keyMap: rebind(DEFAULT_KEY_MAP, "right", 0, "j") });
        return (
            <ServicesProvider services={{ store }}>
                <KeyMapping />
            </ServicesProvider>
        );
    },
};

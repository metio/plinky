// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { memoryStore } from "../../adapters/memoryStore";
import { ServicesProvider } from "../../contexts/services";
import { DangerZone } from "./dangerZone";

// The reset writes through the injected store, so an in-memory backing lets the
// two-step confirm be clicked through without touching real browser storage.
const meta: Meta<typeof DangerZone> = {
    title: "Features/DangerZone",
    component: DangerZone,
};
export default meta;

type Story = StoryObj<typeof DangerZone>;

export const Default: Story = {
    render: function Render() {
        return (
            <ServicesProvider services={{ store: memoryStore() }}>
                <DangerZone />
            </ServicesProvider>
        );
    },
};

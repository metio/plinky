// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { memoryStore } from "../../adapters/memoryStore";
import { ServicesProvider } from "../../contexts/services";
import { ProgressBackup } from "./progressBackup";

// The count comes from the injected store, so an in-memory one with a fixed set of
// keys renders the same figure every time — a live browser store would drift with
// whatever the previous story left behind.
const meta: Meta<typeof ProgressBackup> = {
    title: "Features/ProgressBackup",
    component: ProgressBackup,
};
export default meta;

type Story = StoryObj<typeof ProgressBackup>;

const seeded = memoryStore({
    "plinky:prefs": "{}",
    "plinky:mastery:scale-c-major": '{"bestScore":91,"learned":true}',
    "plinky:takes:ode-to-joy": "[]",
    "plinky:theme": '"dark"',
});

export const Default: Story = {
    render: function Render() {
        return (
            <ServicesProvider services={{ store: seeded }}>
                <ProgressBackup />
            </ServicesProvider>
        );
    },
};

// A fresh device has nothing to carry, so the download is offered but inert.
export const NothingYet: Story = {
    render: function Render() {
        return (
            <ServicesProvider services={{ store: memoryStore() }}>
                <ProgressBackup />
            </ServicesProvider>
        );
    },
};

// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { memoryStore } from "../adapters/memoryStore";
import { ServicesProvider } from "../contexts/services";
import TheoryRoute from "./theory";

// Deterministic by construction: the lesson list is a constant, every demonstration
// lights a fixed set of keys, and nothing sounds until a button is pressed.
const meta: Meta<typeof TheoryRoute> = {
    title: "Routes/Theory",
    component: TheoryRoute,
};
export default meta;

type Story = StoryObj<typeof TheoryRoute>;

export const Default: Story = {
    render: function Render() {
        return (
            <ServicesProvider services={{ store: memoryStore() }}>
                <TheoryRoute />
            </ServicesProvider>
        );
    },
};

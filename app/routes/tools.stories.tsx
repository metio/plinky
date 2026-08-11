// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { memoryStore } from "../adapters/memoryStore";
import { ServicesProvider } from "../contexts/services";
import ToolsRoute from "./tools";

// The page renders deterministically: the circle starts on C, both explorers start on
// their first option, and the tap reader shows a dash until someone taps. Nothing here
// reads a clock, so the baseline is stable.
const meta: Meta<typeof ToolsRoute> = {
    title: "Routes/Tools",
    component: ToolsRoute,
};
export default meta;

type Story = StoryObj<typeof ToolsRoute>;

export const Default: Story = {
    render: function Render() {
        return (
            <ServicesProvider services={{ store: memoryStore() }}>
                <ToolsRoute />
            </ServicesProvider>
        );
    },
};

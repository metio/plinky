// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Chip } from "./chip";

const meta: Meta<typeof Chip> = {
    title: "UI/Chip",
    component: Chip,
};
export default meta;

type Story = StoryObj<typeof Chip>;

export const FilterRow: Story = {
    render: function Render() {
        const [selected, setSelected] = useState("Songs");
        return (
            <div className="flex gap-2">
                {["Songs", "Scales", "Studies"].map((kind) => (
                    <Chip key={kind} selected={selected === kind} onClick={() => setSelected(kind)}>
                        {kind}
                    </Chip>
                ))}
            </div>
        );
    },
};

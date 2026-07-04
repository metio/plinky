// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { SegmentedControl } from "./segmentedControl";

const meta: Meta<typeof SegmentedControl> = {
    title: "UI/SegmentedControl",
    component: SegmentedControl,
};
export default meta;

type Story = StoryObj<typeof SegmentedControl>;

export const HandPicker: Story = {
    render: function Render() {
        const [hand, setHand] = useState<"both" | "right" | "left">("both");
        return (
            <SegmentedControl
                label="Hand"
                options={[
                    { id: "both", label: "Both" },
                    { id: "right", label: "Right" },
                    { id: "left", label: "Left" },
                ]}
                value={hand}
                onChange={setHand}
            />
        );
    },
};

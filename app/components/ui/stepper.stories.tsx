// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Stepper } from "./stepper";

const meta: Meta<typeof Stepper> = {
    title: "UI/Stepper",
    component: Stepper,
};
export default meta;

type Story = StoryObj<typeof Stepper>;

export const Tempo: Story = {
    render: function Render() {
        const [bpm, setBpm] = useState(100);
        return (
            <Stepper
                value={`${bpm} bpm`}
                onDecrement={() => setBpm((value) => value - 5)}
                onIncrement={() => setBpm((value) => value + 5)}
                decrementLabel="Slower"
                incrementLabel="Faster"
                canDecrement={bpm > 40}
                canIncrement={bpm < 220}
            />
        );
    },
};

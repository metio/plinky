// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Switch } from "./switch";

const meta: Meta<typeof Switch> = {
    title: "UI/Switch",
    component: Switch,
};
export default meta;

type Story = StoryObj<typeof Switch>;

export const Toggleable: Story = {
    render: function Render() {
        const [checked, setChecked] = useState(false);
        return <Switch checked={checked} onChange={setChecked} label="Metronome" />;
    },
};

export const Disabled: Story = {
    render: () => <Switch checked={false} onChange={() => {}} label="Metronome" disabled />,
};

// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card } from "./card";

const meta: Meta<typeof Card> = { title: "UI/Card", component: Card };
export default meta;

type Story = StoryObj<typeof Card>;

// The three paddings side by side: one radius, one hairline, one ground, so the
// only thing a caller picks is how much air its contents get.
export const Paddings: Story = {
    render: () => (
        <div className="flex flex-col gap-4">
            <Card pad="snug">Snug — a badge or a stat tile.</Card>
            <Card>Normal — the default, a lesson or a tool.</Card>
            <Card pad="roomy">Roomy — a panel that carries a whole form.</Card>
        </div>
    ),
};

// `quiet` groups without framing. The two must stay visibly the same component:
// same radius, same ground, only the border gone.
export const Quiet: Story = {
    render: () => (
        <div className="flex flex-col gap-4">
            <Card>Bordered</Card>
            <Card quiet>Quiet — no border, everything else identical.</Card>
        </div>
    ),
};

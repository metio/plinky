// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { Wordmark } from "./wordmark";

// The name on its own, at the sizes it is actually set at and one far larger.
//
// The large one is the point: the letterforms and their spacing are the mark's, and at the
// header's own 24px a face that fell back or a tracking that went astray is easy to miss.
// Blown up, it is obvious.
const meta: Meta<typeof Wordmark> = {
    title: "UI/Wordmark",
    component: Wordmark,
};
export default meta;

type Story = StoryObj<typeof Wordmark>;

// The size the header wears.
export const Header: Story = {
    render: () => <Wordmark className="text-2xl" />,
};

// With the address as its own tail, the way a promo clip and a thumbnail set it.
export const WithDomain: Story = {
    render: () => <Wordmark domain className="text-2xl" />,
};

// Large enough that the letterforms and the spacing can be judged by eye.
export const Large: Story = {
    render: () => <Wordmark domain className="text-7xl" />,
};

// The two forms together at one size, so the domain's tail can be compared against the
// name it hangs off rather than remembered between two shots.
export const BothForms: Story = {
    render: () => (
        <div className="flex flex-col gap-4">
            <Wordmark className="text-4xl" />
            <Wordmark domain className="text-4xl" />
        </div>
    ),
};

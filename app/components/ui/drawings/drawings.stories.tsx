// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { DRAWINGS, Drawing } from "./drawing";

const meta: Meta = {
    title: "UI/Drawings",
};
export default meta;

type Story = StoryObj;

// Every drawing at the size a method's leaf shows them, on the page's own ground, so a
// change of palette or mode shows in every one of them at once.
export const All: Story = {
    render: () => (
        <div className="grid max-w-2xl grid-cols-4 gap-6">
            {DRAWINGS.map((name) => (
                <figure key={name} className="space-y-1">
                    <Drawing name={name} className="h-auto w-24" />
                    <figcaption className="text-xs text-muted">{name}</figcaption>
                </figure>
            ))}
        </div>
    ),
};

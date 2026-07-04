// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { Disclosure, FieldGroup } from "./disclosure";

const meta: Meta<typeof Disclosure> = {
    title: "UI/Disclosure",
    component: Disclosure,
};
export default meta;

type Story = StoryObj<typeof Disclosure>;

export const Folded: Story = {
    render: () => (
        <Disclosure summary="More options">
            <FieldGroup label="Practice">
                <p className="text-sm">The folded practice tools would sit here.</p>
            </FieldGroup>
        </Disclosure>
    ),
};

export const Open: Story = {
    render: () => (
        <Disclosure summary="More options" defaultOpen>
            <FieldGroup label="Practice">
                <p className="text-sm">Open by default for the story.</p>
            </FieldGroup>
        </Disclosure>
    ),
};

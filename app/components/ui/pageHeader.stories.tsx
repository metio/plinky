// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import { PageHeader } from "./pageHeader";

const meta: Meta<typeof PageHeader> = { title: "UI/PageHeader", component: PageHeader };
export default meta;

type Story = StoryObj<typeof PageHeader>;

// A title on its own — the shape most pages use.
export const TitleOnly: Story = { render: () => <PageHeader title="Music" /> };

// Every slot filled: the small caps above, the title, the line under it, and a
// control opposite. On a narrow screen the control wraps under the title.
export const Full: Story = {
    render: () => (
        <PageHeader
            eyebrow="Grade 3"
            title="Minuet in G"
            hint="Johann Sebastian Bach — public domain, engraved by OpenScore."
            actions={
                <Button variant="secondary" onClick={() => {}}>
                    Export
                </Button>
            }
        />
    ),
};

// Two headers stacked, which is what makes a drift in spacing legible: the gap
// under a title has to be the same whether or not it carries a hint.
export const Spacing: Story = {
    render: () => (
        <div className="flex flex-col gap-8">
            <PageHeader title="You" hint="Everything this device has recorded." />
            <PageHeader eyebrow="Today" title="Warm-up" />
        </div>
    ),
};

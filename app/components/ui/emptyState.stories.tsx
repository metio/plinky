// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import { EmptyState } from "./emptyState";

const meta: Meta<typeof EmptyState> = { title: "UI/EmptyState", component: EmptyState };
export default meta;

type Story = StoryObj<typeof EmptyState>;

// The ordinary case: a sentence and one thing to press. An empty screen is an
// invitation, so it carries an action.
export const WithAction: Story = {
    render: () => (
        <EmptyState body="No recordings yet. Play a piece and your take is kept here.">
            <Button variant="primary" onClick={() => {}}>
                Play something
            </Button>
        </EmptyState>
    ),
};

// Where the action genuinely lives elsewhere, links take the slot instead.
export const WithLinks: Story = {
    render: () => (
        <EmptyState body="Nothing is due today.">
            <Button variant="secondary" onClick={() => {}}>
                Browse music
            </Button>
            <Button variant="ghost" onClick={() => {}}>
                See the roadmap
            </Button>
        </EmptyState>
    ),
};

// A sentence on its own, for the one place where there is nothing to offer.
export const BodyOnly: Story = {
    render: () => <EmptyState body="No pieces match that search." />,
};

// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import { FeatureBoundary } from "./featureBoundary";

// What a reader sees where a panel used to be. Deliberately panel-sized and quiet: it
// sits among working panels, so it should read as one part having stopped rather than
// as an alarm about the page.
function Broken(): never {
    throw new Error("this panel could not be drawn");
}

const meta: Meta<typeof FeatureBoundary> = {
    title: "Features/FeatureBoundary",
    component: FeatureBoundary,
};
export default meta;

type Story = StoryObj<typeof FeatureBoundary>;

export const PanelStopped: Story = {
    render: () => (
        <div className="space-y-3">
            <p className="text-sm text-muted">A panel above, working.</p>
            <FeatureBoundary feature="ExamplePanel">
                <Broken />
            </FeatureBoundary>
            <p className="text-sm text-muted">A panel below, working.</p>
        </div>
    ),
};

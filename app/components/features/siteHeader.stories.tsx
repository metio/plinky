// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { memoryStore } from "../../adapters/memoryStore";
import { ServicesProvider } from "../../contexts/services";
import { SiteHeader } from "./siteHeader";

// The bar every page wears. It had no stories at all while it lived inside the root
// layout, which meant the lockup's tittle, the bouquet's five colours and the slim sticky
// bar were all going unchecked — and the tittle had in fact drifted from the one the promo
// thumbnails set.
//
// An empty in-memory world on purpose: the grade badge reports nothing until a run has been
// saved, so this is the header a new player meets.
const meta: Meta<typeof SiteHeader> = {
    title: "Features/SiteHeader",
    component: SiteHeader,
    decorators: [
        (Story) => (
            <ServicesProvider services={{ store: memoryStore() }}>
                <Story />
            </ServicesProvider>
        ),
    ],
};
export default meta;

type Story = StoryObj<typeof SiteHeader>;

// Wide enough for the inline destinations: the mark on the left, the nav in the middle,
// help and settings on the right.
export const Default: Story = {};

// A phone. The destinations move to the fixed bottom bar below `md`, so the header keeps
// only the mark and the two things reachable from anywhere — this is the state that must
// not crowd, and the one a screenshot at desktop width would never show.
export const Phone: Story = {
    render: () => (
        <div className="w-[390px]">
            <SiteHeader />
        </div>
    ),
};

// The narrowest layout the width gate holds the site to. The mark cannot shrink, so this
// is where the bar is tightest.
export const Narrowest: Story = {
    render: () => (
        <div className="w-[320px]">
            <SiteHeader />
        </div>
    ),
};

// Just past the breakpoint, where the inline destinations reappear beside a mark that has
// not moved.
export const Tablet: Story = {
    render: () => (
        <div className="w-[768px]">
            <SiteHeader />
        </div>
    ),
};

// The lockup on its own, large. The tittle is drawn rather than typed — core/wordmark says
// where — and at this size a wrong offset is obvious where the header's own 20px is not.
export const Lockup: Story = {
    render: () => (
        <div className="bg-raised p-8 text-6xl">
            <SiteHeader />
        </div>
    ),
};

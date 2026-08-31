// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { memoryStore } from "../../adapters/memoryStore";
import { ServicesProvider } from "../../contexts/services";
import { GradeBadgeView } from "./gradeBadge";
import { SiteHeader } from "./siteHeader";

// A fixed badge. The real one reads the mastery store and renders nothing until that
// resolves, which makes a screenshot of this bar a race — it passed here every run and
// failed on CI by 749 pixels, almost exactly the badge's own ink. Stories pass the
// presentational half, the same one GradeBadge's own stories use.
const BADGE = <GradeBadgeView level={3} skill={214} competitive={false} />;

// The bar every page wears. It had no stories at all while it lived inside the root
// layout, which meant the lockup's tittle, the bouquet's five colours and the slim sticky
// bar were all going unchecked — and the tittle had in fact drifted from the one the promo
// thumbnails set.
//
// An empty in-memory world, so nothing here depends on stored data.
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
export const Default: Story = { render: () => <SiteHeader badge={BADGE} /> };

// A phone. The destinations move to the fixed bottom bar below `md`, so the header keeps
// only the mark and the two things reachable from anywhere — this is the state that must
// not crowd, and the one a screenshot at desktop width would never show.
export const Phone: Story = {
    render: () => (
        <div className="w-[390px]">
            <SiteHeader badge={BADGE} />
        </div>
    ),
};

// The narrowest layout the width gate holds the site to. The mark cannot shrink, so this
// is where the bar is tightest.
export const Narrowest: Story = {
    render: () => (
        <div className="w-[320px]">
            <SiteHeader badge={BADGE} />
        </div>
    ),
};

// The header a new player meets: no badge at all, because the real one shows nothing until
// a run has been saved. Worth a shot of its own — it is what every first visit looks like.
export const NoGrade: Story = {
    render: () => <SiteHeader badge={null} />,
};

// A middling width, with the inline destinations still shown.
//
// Deliberately NOT 768px, which is both the `md` breakpoint and the header's own
// `max-w-3xl`. Sitting a screenshot exactly where a container stops growing puts it on a
// sub-pixel boundary, and the two machines that rasterize it disagreed there by the same
// 615 pixels every run — a difference that is real, reproducible, and about rounding
// rather than about anything this story exists to show.
export const Middling: Story = {
    render: () => (
        <div className="w-[700px]">
            <SiteHeader badge={BADGE} />
        </div>
    ),
};

// The mark itself is storied in UI/Wordmark, where it can be set at a size that shows the
// tittle. A story here claiming to do that could not: `text-6xl` on a wrapper cannot scale
// a header that sets its own `text-xl`, so it drew the same picture as Default.

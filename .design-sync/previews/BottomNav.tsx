// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Mirrors app/components/ui/navBar.stories.tsx, with one addition the story does not need.
// The bar is `fixed inset-x-0 bottom-0`, so on a page whose only content is the bar there
// is nothing in flow: the wrapper collapses to no height and the bar lays out above the
// top edge, leaving the card blank. A frame with its own height — and a transform, which
// makes it the containing block for fixed descendants — puts the bar back on a floor.
import type { ReactNode } from "react";
import { BottomNav, HeaderNav } from "plinky";

const Frame = ({ children }: { children: ReactNode }) => (
    <div style={{ position: "relative", height: 260, transform: "translateZ(0)" }}>{children}</div>
);

export const Bottom = () => (
    <Frame>
        <BottomNav />
    </Frame>
);

export const Header = () => <HeaderNav className="flex items-center gap-1" />;

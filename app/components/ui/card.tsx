// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ReactNode } from "react";

// A bordered panel: a lesson, a tool, a practice method, a badge, a stat.
//
// Eight of these were hand-rolled at four different radii and three grounds, so the
// "printed things square, touched things round" idea the look rests on was not legible
// anywhere — a card's corner meant nothing, because every card had a different one. One
// radius, one hairline, one ground; a caller chooses only its padding and what it holds.
//
// `quiet` drops the border for a panel that groups without framing, and keeps everything
// else, so the two never drift into two different components.

const PAD = { snug: "p-3", normal: "p-4", roomy: "p-6" } as const;

export function Card({
    pad = "normal",
    quiet = false,
    className = "",
    children,
}: {
    pad?: keyof typeof PAD;
    quiet?: boolean;
    className?: string;
    children: ReactNode;
}) {
    return (
        <div
            className={`rounded-lg bg-surface ${PAD[pad]} ${quiet ? "" : "border border-line"} ${className}`}
        >
            {children}
        </div>
    );
}

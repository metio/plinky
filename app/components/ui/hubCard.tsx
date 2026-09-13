// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ReactNode } from "react";

// The card a hub is made of: an icon, whatever the caller puts beside it, and a lift on
// hover — bordered and raised, so a column of them reads as several things rather than as
// one long page. The card is the frame and the contents are the caller's; where the whole
// card goes somewhere it is drawn as a link.
//
// Silent: only a key that is pressed makes a note in Plinky, never a pointer passing over.
export function HubCard({
    Icon,
    as: As = "div",
    className = "",
    children,
    ...rest
}: {
    Icon: (props: { className?: string }) => ReactNode;
    // The element to draw. A link when the whole card goes somewhere, otherwise a div.
    as?: React.ElementType;
    className?: string;
    children: ReactNode;
    // Whatever the chosen element needs — `to` for a link, and nothing for a div.
    [key: string]: unknown;
}) {
    return (
        <As
            {...rest}
            className={`group flex items-start gap-4 rounded-xl border border-line bg-raised p-5 transition hover:-translate-y-0.5 hover:border-accent-line-strong hover:shadow-md ${className}`}
        >
            <Icon className="mt-0.5 h-8 w-8 shrink-0 text-accent group-hover:text-accent-strong" />
            {children}
        </As>
    );
}

// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ReactNode } from "react";

// The card a hub is made of: an icon, whatever the caller puts beside it, and a lift on
// hover — bordered and raised, so a column of them reads as several things rather than as
// one long page.
//
// Two places want it and they want different insides. The hubs (Learn, Music) put a whole
// destination in one, so the card IS a link. Ways to practise puts a heading, two
// paragraphs and its own action button in one, so the card must not be a link — a link
// around a link is not a thing. That is the only difference, which is why the frame is
// here and the contents are the caller's.
//
// A mouse crossing it sounds a note where one is given. Mouse only: on a touch screen
// pointerenter arrives with the tap that is already opening something, and a note firing
// under a finger is a surprise rather than a flourish.
export function HubCard({
    Icon,
    note,
    onEnter,
    as: As = "div",
    className = "",
    children,
    ...rest
}: {
    Icon: (props: { className?: string }) => ReactNode;
    note?: number;
    onEnter?: (note: number) => void;
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
            onPointerEnter={(event: React.PointerEvent) => {
                if (event.pointerType === "mouse" && note !== undefined) {
                    onEnter?.(note);
                }
            }}
            className={`group flex items-start gap-4 rounded-xl border border-line bg-raised p-5 transition hover:-translate-y-0.5 hover:border-accent-line-strong hover:shadow-md ${className}`}
        >
            <Icon className="mt-0.5 h-8 w-8 shrink-0 text-accent group-hover:text-accent-strong" />
            {children}
        </As>
    );
}

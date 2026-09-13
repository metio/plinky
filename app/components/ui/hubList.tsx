// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ReactNode } from "react";
import { HubCard } from "./hubCard";
import { LocalizedLink as Link } from "./localizedLink";

export type HubEntry = {
    to: string;
    label: string;
    blurb: string;
    Icon: (props: { className?: string }) => ReactNode;
};

// A list of destinations, each with room to say what it actually is. The two hubs
// use it — Music for the shelves either side of the catalogue, Learn for the whole
// schoolroom — so a place that gathers things looks the same wherever you meet it.
export function HubList({ entries }: { entries: HubEntry[] }) {
    return (
        <ul className="space-y-3">
            {entries.map((entry) => (
                <li key={entry.to}>
                    <HubCard as={Link} to={entry.to} Icon={entry.Icon}>
                        <span className="space-y-1">
                            <span className="block text-lg font-medium text-ink group-hover:text-accent-strong">
                                {entry.label} →
                            </span>
                            <span className="block text-sm leading-relaxed text-muted">
                                {entry.blurb}
                            </span>
                        </span>
                    </HubCard>
                </li>
            ))}
        </ul>
    );
}

// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ReactNode } from "react";
import { LocalizedLink as Link } from "./localizedLink";

export type HubEntry = {
    to: string;
    label: string;
    blurb: string;
    Icon: (props: { className?: string }) => ReactNode;
    // A MIDI note to sound when a mouse crosses the entry, so running down a list
    // plays a line. Left off, the entry is silent.
    note?: number;
};

// A list of destinations, each with room to say what it actually is. The two hubs
// use it — Music for the shelves either side of the catalogue, Learn for the whole
// schoolroom — so a place that gathers things looks the same wherever you meet it.
export function HubList({
    entries,
    onEnter,
}: {
    entries: HubEntry[];
    // Called when a mouse (never a touch — pointerenter fires on every tap) crosses
    // an entry carrying a note.
    onEnter?: (note: number) => void;
}) {
    return (
        <ul className="space-y-3">
            {entries.map((entry) => (
                <li key={entry.to}>
                    <Link
                        to={entry.to}
                        onPointerEnter={(event) => {
                            if (event.pointerType === "mouse" && entry.note !== undefined) {
                                onEnter?.(entry.note);
                            }
                        }}
                        className="group flex items-start gap-4 rounded-xl border border-line bg-raised p-5 transition hover:-translate-y-0.5 hover:border-accent-line-strong hover:shadow-md"
                    >
                        <entry.Icon className="mt-0.5 h-8 w-8 shrink-0 text-accent group-hover:text-accent-strong" />
                        <span className="space-y-1">
                            <span className="block text-lg font-medium text-ink group-hover:text-accent-strong">
                                {entry.label} →
                            </span>
                            <span className="block text-sm leading-relaxed text-muted">
                                {entry.blurb}
                            </span>
                        </span>
                    </Link>
                </li>
            ))}
        </ul>
    );
}

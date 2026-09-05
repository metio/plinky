// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { getLocale } from "../../paraglide/runtime.js";

// A number with a caption: days practised, notes played, a session's length. The one
// tile every figure on the Stats page is drawn with, so the page reads as one page — it
// used to show its lifetime numbers in three styles depending on which feature drew
// them, and only one of the three localised the number.
//
// `framed` draws the tile on its own card; off, the tile sits on whatever holds it, as
// inside the scope card's own gradient. `tone` lifts a figure in the accent colour.
export function StatTile({
    label,
    value,
    framed = true,
    tone = "ink",
}: {
    label: string;
    value: number | string;
    framed?: boolean;
    tone?: "ink" | "accent";
}) {
    const shown = typeof value === "number" ? value.toLocaleString(getLocale()) : value;
    return (
        <div className={framed ? "rounded-md border border-line bg-surface p-4" : ""}>
            <div
                className={`font-bold text-3xl tabular-nums ${tone === "accent" ? "text-accent-strong" : "text-body"}`}
            >
                {shown}
            </div>
            <div className="text-muted text-xs uppercase tracking-wide">{label}</div>
        </div>
    );
}

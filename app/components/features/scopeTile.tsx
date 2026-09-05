// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { svgMilestone } from "../../../core/milestoneCard";
import type { Scope, ScopeSummary } from "../../../core/statsScope";
import { ShareButtons } from "./shareButtons";
import { m } from "../../paraglide/messages.js";
import { getLocale } from "../../paraglide/runtime.js";
import { StatTile } from "../ui/statTile";

// What the window is called, in the reader's own language. A calendar scope has a name —
// August 2026, 2026 — where a rolling one could only be described, which is half the reason
// the scopes are calendar periods.
export function scopeName(scope: Scope, now: Date): string {
    switch (scope) {
        case "all":
            return m.scope_all_name();
        case "year":
            return String(now.getFullYear());
        case "month":
            return new Intl.DateTimeFormat(getLocale(), { month: "long", year: "numeric" }).format(
                now,
            );
        case "week":
            return m.scope_week_name();
    }
}

// The head of the "How it's going" block: the three figures for whichever window the dial
// is on, and the buttons to show somebody.
//
// One tile in place of two things that used to sit at opposite ends of the page — a
// lifetime total near the top and a monthly recap card near the foot — which were the same
// three numbers over two windows, with nothing on the page saying so.
export function ScopeTile({
    scope,
    summary,
    now,
}: {
    scope: Scope;
    summary: ScopeSummary;
    // The clock the window was measured against, so the name and the figures cannot
    // disagree. Injected rather than read here for the usual reason: a story pins it.
    now: Date;
}) {
    const name = scopeName(scope, now);
    const notes = summary.totalNotes.toLocaleString(getLocale());
    // Every figure on the tile, in one sentence. The share used to carry the month's name
    // and none of its practice.
    const boast = m.recap_boast({ notes, days: summary.daysPracticed, month: name });
    return (
        <section className="space-y-4 rounded-xl border border-accent-line bg-gradient-to-br from-accent-surface to-ghost-surface p-5 dark:to-ghost-surface/40">
            <h3 className="font-semibold text-accent-ink text-lg">{name}</h3>
            <div className="flex gap-8">
                <StatTile
                    value={summary.totalNotes}
                    label={m.progress_notes_played()}
                    framed={false}
                    tone="accent"
                />
                <StatTile
                    value={summary.daysPracticed}
                    label={m.progress_days_practiced()}
                    framed={false}
                    tone="accent"
                />
            </div>
            {summary.bestDay && (
                <p className="text-muted text-sm">
                    {m.recap_best_day({ count: summary.bestDay.notes })}
                </p>
            )}
            <ShareButtons
                text={boast}
                imageSvg={svgMilestone({
                    // The number is the card and the window is the line under it: a month
                    // name set at the title's size runs off the edge.
                    title: notes,
                    detail: m.recap_card_detail({ month: name, days: summary.daysPracticed }),
                })}
                imageText={boast}
            />
        </section>
    );
}

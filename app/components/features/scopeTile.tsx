// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { svgMilestone } from "../../../core/milestoneCard";
import type { Scope, ScopeSummary } from "../../../core/statsScope";
import { ShareButtons } from "./shareButtons";
import { m } from "../../paraglide/messages.js";
import { getLocale } from "../../paraglide/runtime.js";
import { Folio, FolioFigure, FolioRow } from "../ui/folio";

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
    // The note count arrives written the locale's way ("12,345"), which no plural rule can
    // read, so its phrase is chosen by the raw number and set into the sentence whole.
    const boast = m.recap_boast({
        notes: m.recap_boast_notes({ notes, count: summary.totalNotes }),
        days: summary.daysPracticed,
        month: name,
    });
    return (
        <section className="space-y-4">
            <h3 className="font-display text-xl font-medium text-ink">{name}</h3>
            {/* The figures in the margin, what they count beside them. The best day is a
                line under the notes because it is a count of notes too. */}
            <Folio>
                <FolioRow
                    margin={<FolioFigure value={summary.totalNotes} />}
                    name={m.progress_notes_played()}
                    line={
                        summary.bestDay
                            ? m.recap_best_day({ count: summary.bestDay.notes })
                            : undefined
                    }
                />
                <FolioRow
                    margin={<FolioFigure value={summary.daysPracticed} />}
                    name={m.progress_days_practiced()}
                />
            </Folio>
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

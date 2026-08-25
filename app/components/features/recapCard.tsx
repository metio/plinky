// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { MonthlyRecap } from "../../../core/history";
import { svgMilestone } from "../../../core/milestoneCard";
import { ShareButtons } from "./shareButtons";
import { m } from "../../paraglide/messages.js";
import { getLocale } from "../../paraglide/runtime.js";

// The month's name in the reader's language — "July 2026", "juillet 2026" — from Intl,
// so the twelve month names never need translating by hand. The day is fixed at the
// first so the parse lands squarely in the month whatever the runner's time zone.
function monthLabel(month: string): string {
    return new Intl.DateTimeFormat(getLocale(), { month: "long", year: "numeric" }).format(
        new Date(`${month}-01T00:00:00`),
    );
}

// A Wrapped-style card of the month's practice: the notes played, the days at the keys,
// and the biggest day, with the app's own share row under it. A reward the You page offers
// when a month has practice to celebrate — never a reminder, never shown for an empty
// month.
export function RecapCard({ recap }: { recap: MonthlyRecap }) {
    const heading = m.recap_heading({ month: monthLabel(recap.month) });

    // Everything the card says, in one sentence a reader can post. It used to share the
    // heading alone — "Your August 2026 in music" — which is the one line on the card that
    // carries no information: the month is in it and the practice is not.
    const boast = m.recap_boast({
        notes: recap.totalNotes.toLocaleString(getLocale()),
        days: recap.daysPracticed,
        month: monthLabel(recap.month),
    });

    return (
        <section className="space-y-4 rounded-xl border border-accent-line bg-gradient-to-br from-accent-surface to-ghost-surface p-5 dark:to-ghost-surface/40">
            <h3 className="font-semibold text-accent-ink text-lg">{heading}</h3>
            <div className="flex gap-8">
                <Stat value={recap.totalNotes} label={m.progress_notes_played()} />
                <Stat value={recap.daysPracticed} label={m.progress_days_practiced()} />
            </div>
            {recap.bestDay && (
                <p className="text-muted text-sm">
                    {m.recap_best_day({ count: recap.bestDay.notes })}
                </p>
            )}
            {/* The same buttons the grade milestone below this page uses — the platforms,
                the system share sheet, and the card as an image — rather than one button
                of its own. A month worth showing somebody is shown the same way a grade
                is. */}
            <ShareButtons
                text={boast}
                imageSvg={svgMilestone({
                    // The number is the card, and the month and days are the line under
                    // it: a month name set at the title's size runs off the edge.
                    title: recap.totalNotes.toLocaleString(getLocale()),
                    detail: m.recap_card_detail({
                        month: monthLabel(recap.month),
                        days: recap.daysPracticed,
                    }),
                })}
                imageText={boast}
            />
        </section>
    );
}

function Stat({ value, label }: { value: number; label: string }) {
    return (
        <div>
            <div className="font-bold text-3xl text-accent-strong tabular-nums">
                {value.toLocaleString(getLocale())}
            </div>
            <div className="text-muted text-xs uppercase tracking-wide">{label}</div>
        </div>
    );
}

// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { daysSince, repertoireBalance } from "../../../core/repertoireBalance";
import { usePracticeLog } from "../../hooks/usePracticeLog";
import { practiceDuration } from "../../lib/practiceDuration";
import { m } from "../../paraglide/messages.js";
import { sectionHeadingClasses } from "../ui/classes";

// Where the practice time actually went, piece by piece.
//
// The report beside this one is ordered by date, and a piece being forgotten is exactly
// the one that stops appearing in a list ordered by date. Turned the other way round —
// a row per piece, longest-practised first, each saying when it was last touched — the
// gap is the thing you see first.
//
// No targets and no scolding. "Three weeks ago" is a fact, and what to do about it is
// the player's business.

// Enough rows to show a rotation and its edges. The whole log is in the CSV the report
// offers; an unbounded list would bury the pieces at the top under the ones nobody is
// playing.
const LISTED = 8;

export function PracticeBalance({
    pieceTitle = (id) => id,
    now = Date.now(),
    headed = true,
}: {
    // Resolves a catalogue id to its title, injected rather than looked up here — the
    // panel has no business reading the library.
    pieceTitle?: (id: string) => string;
    // The instant "last played" is measured back from. Injected by stories and tests,
    // which need a clock that does not move.
    now?: number;
    // Whether the panel draws its own heading. The Stats page heads each of its
    // questions once and gathers the answers beneath, so a panel answering one of them
    // must not restate its name — two headings for one thing is what made that page read
    // as a stack of sections rather than a set of answers. Everywhere else it still names
    // itself.
    headed?: boolean;
}) {
    const log = usePracticeLog();
    if (!log) {
        return null;
    }
    const entries = repertoireBalance(log).slice(0, LISTED);
    if (entries.length === 0) {
        return null;
    }
    const busiest = entries[0]?.activeMs ?? 0;

    return (
        <section className="space-y-3">
            <div className="space-y-1">
                {headed && <h2 className={sectionHeadingClasses}>{m.balance_title()}</h2>}
                <p className="text-xs text-muted">{m.balance_intro()}</p>
            </div>
            <ul className="space-y-2">
                {entries.map((entry) => {
                    const days = daysSince(entry, now);
                    return (
                        <li key={entry.piece} className="space-y-1">
                            <div className="flex items-baseline justify-between gap-3 text-sm">
                                <span className="truncate text-body">
                                    {pieceTitle(entry.piece)}
                                </span>
                                <span className="shrink-0 tabular-nums text-muted">
                                    {practiceDuration(entry.activeMs)}
                                </span>
                            </div>
                            {/* The bar is the same comparison the numbers beside it make,
                                so it carries no information of its own and is hidden from
                                a reader who is having the row read out to them. */}
                            <div aria-hidden="true" className="h-1.5 rounded-full bg-line">
                                <div
                                    className="h-full rounded-full bg-accent-solid"
                                    style={{
                                        width: `${busiest > 0 ? (entry.activeMs / busiest) * 100 : 0}%`,
                                    }}
                                />
                            </div>
                            <p className="text-xs text-muted">
                                {days === 0
                                    ? m.balance_last_today()
                                    : days === 1
                                      ? m.balance_last_one({ days })
                                      : m.balance_last_other({ days })}
                            </p>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

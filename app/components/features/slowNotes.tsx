// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useSyncExternalStore } from "react";
import { useNoteNaming } from "../../hooks/useNoteNaming";
import { pitchName } from "../../lib/noteNames";
import { type NoteStats, slowestNotes, typicalMs } from "../../../core/noteStats";
import { secondsFigure } from "../../../core/seconds";
import { useNoteStatsStore } from "../../contexts/services";
import { m } from "../../paraglide/messages.js";
import { getLocale } from "../../paraglide/runtime.js";
import { sectionHeadingClasses } from "../ui/classes";

// The notes you are slowest to find, longest first.
//
// Shown as a ranked list with bars rather than a heat map over a keyboard: the
// useful question is "which notes should I practise", which a sorted list answers
// directly, and a list can be read aloud by a screen reader while a coloured keybed
// cannot. The bar is the same number again for anyone who reads shapes faster than
// figures.
// One frozen empty record for the prerender snapshot. A fresh object each call would
// be a new value every time React asked, which is the shape that loops.
const NOTHING_YET: NoteStats = {};

export function SlowNotes({
    headed = true,
}: {
    // Whether the panel draws its own heading. The Stats page heads each of its questions
    // once and gathers the answers beneath, so a panel answering one of them must not
    // restate its name — two headings for one thing is what made that page read as a stack
    // of sections rather than a set of answers. Everywhere else it still names itself.
    headed?: boolean;
}) {
    const store = useNoteStatsStore();
    const naming = useNoteNaming();
    const stats = useSyncExternalStore(store.subscribe, store.load, () => NOTHING_YET);
    const slow = slowestNotes(stats);
    const typical = typicalMs(stats);

    // Nothing to say until a few notes have been read enough times to mean anything.
    // An empty frame promising future insight is worse than no frame.
    if (slow.length === 0 || typical === null) {
        return null;
    }

    const slowest = slow[0]?.meanMs ?? 1;
    const locale = getLocale();

    return (
        <section className="space-y-3">
            {headed && <h2 className={sectionHeadingClasses}>{m.slow_notes_heading()}</h2>}
            <p className="text-sm text-muted">
                {m.slow_notes_intro({ typical: secondsFigure(typical, locale) })}
            </p>
            <ul className="space-y-1">
                {slow.map((row) => (
                    <li key={row.note} className="flex items-center gap-3 text-sm">
                        <span className="w-14 shrink-0 font-medium tabular-nums">
                            {pitchName(row.note, naming)}
                        </span>
                        <span
                            className="h-2 rounded-full bg-accent-soft"
                            // The bar is decoration over the figure beside it, so it
                            // carries no separate label for a screen reader to repeat.
                            aria-hidden="true"
                            style={{ width: `${Math.max(4, (row.meanMs / slowest) * 60)}%` }}
                        />
                        <span className="shrink-0 tabular-nums text-muted">
                            {m.slow_notes_seconds({ seconds: secondsFigure(row.meanMs, locale) })}
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
}

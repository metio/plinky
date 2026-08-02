// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useSyncExternalStore } from "react";
import { noteName } from "../../../core/midi";
import { type NoteStats, slowestNotes, typicalMs } from "../../../core/noteStats";
import { useNoteStatsStore } from "../../contexts/services";
import { m } from "../../paraglide/messages.js";

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

export function SlowNotes() {
    const store = useNoteStatsStore();
    const stats = useSyncExternalStore(store.subscribe, store.load, () => NOTHING_YET);
    const slow = slowestNotes(stats);
    const typical = typicalMs(stats);

    // Nothing to say until a few notes have been read enough times to mean anything.
    // An empty frame promising future insight is worse than no frame.
    if (slow.length === 0 || typical === null) {
        return null;
    }

    const slowest = slow[0]?.meanMs ?? 1;

    return (
        <section className="space-y-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
                {m.slow_notes_heading()}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
                {m.slow_notes_intro({ typical: (typical / 1000).toFixed(1) })}
            </p>
            <ul className="space-y-1">
                {slow.map((row) => (
                    <li key={row.note} className="flex items-center gap-3 text-sm">
                        <span className="w-14 shrink-0 font-medium tabular-nums">
                            {noteName(row.note)}
                        </span>
                        <span
                            className="h-2 rounded-full bg-indigo-400 dark:bg-indigo-500"
                            // The bar is decoration over the figure beside it, so it
                            // carries no separate label for a screen reader to repeat.
                            aria-hidden="true"
                            style={{ width: `${Math.max(4, (row.meanMs / slowest) * 60)}%` }}
                        />
                        <span className="shrink-0 tabular-nums text-gray-600 dark:text-gray-400">
                            {m.slow_notes_seconds({ seconds: (row.meanMs / 1000).toFixed(1) })}
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
}

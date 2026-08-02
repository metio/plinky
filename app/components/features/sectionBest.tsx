// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useSyncExternalStore } from "react";
import { bestTotal, SECTIONS, sectionScores } from "../../../core/sectionBest";
import type { Grid, RunNote } from "../../../core/shareCard";
import { useSectionBestStore } from "../../contexts/services";
import { m } from "../../paraglide/messages.js";

// Your best reading of this piece, assembled from the best each section has ever
// been. It can only go up, and it goes up whenever any part of the piece improves —
// which is what getting better at a piece actually feels like, and what a single
// per-run grade cannot show.
//
// Read from the store rather than passed in: the run was folded in before this
// renders, so what is on screen is the record as it now stands.
export function SectionBest({
    scoreId,
    notes,
    tolerance,
    tempoScale,
}: {
    scoreId: string;
    notes: RunNote[];
    tolerance: number;
    tempoScale: number;
    grid?: Grid | null;
}) {
    const store = useSectionBestStore();
    const best = useSyncExternalStore(
        store.subscribe,
        () => store.load(scoreId),
        () => null,
    );

    if (!best) {
        return null;
    }

    const run = sectionScores(notes, { tolerance, tempoScale });
    // A section where this run matches the record is one this run just set (or
    // equalled) — the merge has already happened, so this is what "you did that now"
    // looks like from here.
    const setNow = run.filter((score, index) => score > 0 && score === best[index]).length;

    return (
        <section className="space-y-2">
            <h3 className="text-sm font-medium text-body">
                {m.section_best_heading({ total: bestTotal(best) })}
            </h3>
            <ol className="flex gap-1" aria-label={m.section_best_label()}>
                {best.map((score, index) => (
                    <li
                        // Sections are positions in the piece, so the index is the
                        // identity — there is nothing else to key on.
                        // biome-ignore lint/suspicious/noArrayIndexKey: the index is the section
                        key={index}
                        className="flex h-10 flex-1 items-end rounded bg-subtle"
                        title={m.section_best_section({ number: index + 1, score })}
                    >
                        <span
                            className={`w-full rounded ${
                                run[index] === score && score > 0
                                    ? "bg-chart-peak"
                                    : "bg-chart-track"
                            }`}
                            style={{ height: `${Math.max(4, score)}%` }}
                        />
                    </li>
                ))}
            </ol>
            <p className="text-xs text-muted">
                {setNow > 0
                    ? m.section_best_set({ count: setNow, total: SECTIONS })
                    : m.section_best_none()}
            </p>
        </section>
    );
}

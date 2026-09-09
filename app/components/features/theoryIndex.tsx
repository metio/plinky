// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { lessonsIn, UNITS } from "../../../core/theoryCourse";
import { m } from "../../paraglide/messages.js";
import { sectionLabelClasses } from "../ui/classes";
import { LocalizedLink } from "../ui/localizedLink";

// The course as a list you can jump around in, beside the lesson you are reading.
//
// A lesson is written to be read after the one before it, which is why the index keeps
// the course's order and its numbering rather than sorting by anything — but somebody who
// came back for the lesson on note values should not have to find it by scrolling past
// nine others.
//
// Links to each lesson's own address, not anchors into one long page. An anchor can only
// ever move a reader down the page it is already on: it is not somewhere a search engine
// can send anybody, and the fourteen lessons then compete with the one page that repeats
// all of them. Every lesson is prerendered at /theory/<id>/, so the index hands both a
// reader and a crawler the same real destination. The glossary's index reads the same way
// for the same reason.
export function TheoryIndex({
    titles,
    numbers,
    selected,
}: {
    titles: Record<string, () => string>;
    numbers: Map<string, number>;
    selected: string;
}) {
    return (
        <nav aria-label={m.theory_index_label()} className="space-y-5">
            {UNITS.map((unit) => (
                <div key={unit} className="space-y-1">
                    {/* A group label rather than a heading: the page's outline is its
                    title and its units, and repeating them inside the index would bury
                    that. The list carries the name for a screen reader. */}
                    <p className={sectionLabelClasses}>{UNIT_LABEL[unit]?.() ?? unit}</p>
                    <ul aria-label={UNIT_LABEL[unit]?.() ?? unit}>
                        {lessonsIn(unit).map((lesson) => {
                            const current = lesson.id === selected;
                            return (
                                <li key={lesson.id}>
                                    <LocalizedLink
                                        to={`/theory/${lesson.id}/`}
                                        // The lesson being read is the page you are on, so
                                        // this is aria-current="page" rather than the bare
                                        // "true" an in-page selection would carry.
                                        aria-current={current ? "page" : undefined}
                                        className={`flex min-h-11 items-center rounded-md px-3 text-sm transition-colors ${
                                            current
                                                ? "bg-accent-fill font-medium text-accent-ink"
                                                : "text-body hover:bg-subtle"
                                        }`}
                                    >
                                        <span
                                            className={`tabular-nums ${current ? "text-accent-ink" : "text-muted"}`}
                                        >
                                            {numbers.get(lesson.id)}.
                                        </span>
                                        <span className="ml-1">
                                            {titles[lesson.id]?.() ?? lesson.id}
                                        </span>
                                    </LocalizedLink>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ))}
        </nav>
    );
}

const UNIT_LABEL: Record<string, () => string> = {
    reading: () => m.theory_unit_reading(),
    keys: () => m.theory_unit_keys(),
    harmony: () => m.theory_unit_harmony(),
};

// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { lessonsIn, UNITS } from "../../../core/theoryCourse";
import { m } from "../../paraglide/messages.js";
import { sectionLabelClasses } from "../ui/classes";

// The course as a list you can jump around in, beside the course itself.
//
// A lesson is written to be read after the one before it, which is why the page is a
// scroll rather than a menu — but somebody who came back for the lesson on note values
// should not have to find it by scrolling past nine others. The glossary already solved
// this for lookup; this is the same index over ordered material, which does not change
// what the course is, only how you re-enter it.
//
// Anchors rather than state: every lesson already renders with its own id and scroll
// margin, because the day's practice links straight at one.
export function TheoryIndex({
    titles,
    numbers,
}: {
    titles: Record<string, () => string>;
    numbers: Map<string, number>;
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
                        {lessonsIn(unit).map((lesson) => (
                            <li key={lesson.id}>
                                <a
                                    href={`#${lesson.id}`}
                                    className="block rounded-md px-2 py-1 text-sm text-muted hover:bg-subtle hover:text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
                                >
                                    <span className="tabular-nums text-faint">
                                        {numbers.get(lesson.id)}.
                                    </span>{" "}
                                    {titles[lesson.id]?.() ?? lesson.id}
                                </a>
                            </li>
                        ))}
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

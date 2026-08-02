// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { CATEGORIES, entriesIn } from "../../../core/glossary";
import { CATEGORY_NAMES, symbolName } from "../../lib/glossaryLabels";
import { m } from "../../paraglide/messages.js";

// The way in: every symbol, grouped by what it controls.
//
// The grouping is the teaching. A reader who arrives knowing only that they met a
// curved line can see that marks come in four kinds — how long, how you touch it, how
// loud, where you are — and that a curve is about touch, before reading a single entry.
// An alphabetical list would sort `slur` next to `staccato` and tell them nothing.
export function GlossaryIndex({
    selected,
    onSelect,
}: {
    selected: string;
    onSelect: (id: string) => void;
}) {
    return (
        <nav aria-label={m.glossary_index_label()} className="space-y-5">
            {CATEGORIES.map((category) => (
                <div key={category} className="space-y-1">
                    {/* A group label rather than a heading: the page's heading outline is
                    its title and the symbol being read, and four more headings inside the
                    index would bury that. The list carries the name for a screen reader. */}
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">
                        {CATEGORY_NAMES[category]()}
                    </p>
                    <ul aria-label={CATEGORY_NAMES[category]()}>
                        {entriesIn(category).map((entry) => {
                            const current = entry.id === selected;
                            return (
                                <li key={entry.id}>
                                    <button
                                        type="button"
                                        onClick={() => onSelect(entry.id)}
                                        // aria-current marks the one being read, which is
                                        // what a screen reader needs here — these are
                                        // in-page selections, not links to elsewhere.
                                        aria-current={current ? "true" : undefined}
                                        className={`flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm transition-colors ${
                                            current
                                                ? "bg-indigo-100 font-medium text-indigo-900 dark:bg-indigo-900 dark:text-indigo-100"
                                                : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                                        }`}
                                    >
                                        {symbolName(entry.id)}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ))}
        </nav>
    );
}

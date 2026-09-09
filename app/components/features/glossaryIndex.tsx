// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { CATEGORIES, entriesIn } from "../../../core/glossary";
import { CATEGORY_NAMES, symbolName } from "../../lib/glossaryLabels";
import { m } from "../../paraglide/messages.js";
import { sectionLabelClasses } from "../ui/classes";
import { LocalizedLink } from "../ui/localizedLink";

// The way in: every symbol, grouped by what it controls.
//
// The grouping is the teaching. A reader who arrives knowing only that they met a
// curved line can see that marks come in four kinds — how long, how you touch it, how
// loud, where you are — and that a curve is about touch, before reading a single entry.
// An alphabetical list would sort `slur` next to `staccato` and tell them nothing.
//
// Links, not buttons. Every mark is prerendered at its own address and the page it opens
// says the mark's name in its title, so choosing one is a navigation and should behave
// like one: it can be opened in a new tab, copied, bookmarked and followed by a crawler.
// A button carrying a click handler is none of those things, which left fifty pages
// reachable from the sitemap and from nowhere a reader could point at.
export function GlossaryIndex({ selected }: { selected: string }) {
    return (
        <nav aria-label={m.glossary_index_label()} className="space-y-5">
            {CATEGORIES.map((category) => (
                <div key={category} className="space-y-1">
                    {/* A group label rather than a heading: the page's heading outline is
                    its title and the symbol being read, and four more headings inside the
                    index would bury that. The list carries the name for a screen reader. */}
                    <p className={sectionLabelClasses}>{CATEGORY_NAMES[category]()}</p>
                    <ul aria-label={CATEGORY_NAMES[category]()}>
                        {entriesIn(category).map((entry) => {
                            const current = entry.id === selected;
                            return (
                                <li key={entry.id}>
                                    <LocalizedLink
                                        to={`/glossary/${entry.id}/`}
                                        // The mark being read is the page you are on, so
                                        // this is aria-current="page" rather than the bare
                                        // "true" an in-page selection would carry.
                                        aria-current={current ? "page" : undefined}
                                        className={`flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm transition-colors ${
                                            current
                                                ? "bg-accent-fill font-medium text-accent-ink"
                                                : "text-body hover:bg-subtle"
                                        }`}
                                    >
                                        {symbolName(entry.id)}
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

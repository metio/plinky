// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { PEOPLE_INDEX } from "../../../core/peopleIndex";
import { foldForSearch } from "../../../core/library";
import { m } from "../../paraglide/messages.js";
import { linkClasses } from "../ui/classes";
import { LocalizedLink as Link } from "../ui/localizedLink";

// Everybody the catalogue credits, with how much of theirs there is to play.
//
// A composer's page existed and could only be reached from a piece already found — which
// inverts the question a reader actually arrives with. The index is baked at build time
// (core/peopleIndex), so this costs no fetch: the names are already in the bundle for the
// prerendered person pages.
//
// It shares the shelf's search box, folded the same way, so "faure" finds Fauré.
export function ComposerList({ query }: { query: string }) {
    const needle = foldForSearch(query.trim());
    const people = Object.entries(PEOPLE_INDEX)
        .filter(([, person]) => (needle ? foldForSearch(person.name).includes(needle) : true))
        .sort(([, a], [, b]) => a.name.localeCompare(b.name));

    if (people.length === 0) {
        return <p className="text-sm text-muted">{m.scores_empty()}</p>;
    }

    return (
        <ul className="divide-y divide-line-faint">
            {people.map(([slug, person]) => (
                <li key={slug} className="flex items-baseline justify-between gap-3 py-1.5">
                    <Link to={`/person/${slug}`} className={`min-w-0 truncate ${linkClasses}`}>
                        {person.name}
                    </Link>
                    <span className="shrink-0 text-xs text-muted tabular-nums">
                        {m.person_pieces({ count: person.pieces })}
                    </span>
                </li>
            ))}
        </ul>
    );
}

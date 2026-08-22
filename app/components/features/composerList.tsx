// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo } from "react";
import { foldForSearch } from "../../../core/music";
import type { PersonCount } from "../../../core/person";
import { m } from "../../paraglide/messages.js";
import { linkClasses } from "../ui/classes";
import { LocalizedLink as Link } from "../ui/localizedLink";

// Everybody the catalogue credits, with how much of theirs there is to play.
//
// A composer's page existed and could only be reached from a piece already found — which
// inverts the question a reader actually arrives with.
//
// The people are handed in, grouped from the same catalogue the shelf is listing. This
// used to read core/peopleIndex instead, which is a prerender artefact rather than a
// directory: it deliberately holds only composers with three pieces or more, because the
// rest have their pages rendered on the client. Used as the list, that quietly cut four
// out of every five composers, including from the search — so somebody with two pieces in
// the catalogue could not be found here at all, under a heading promising everybody.
//
// It shares the shelf's search box, folded the same way, so "faure" finds Fauré.
export function ComposerList({ people, query }: { people: readonly PersonCount[]; query: string }) {
    const needle = foldForSearch(query.trim());
    // Already alphabetical, which is how a directory is read.
    const shown = useMemo(
        () => (needle ? people.filter((one) => foldForSearch(one.name).includes(needle)) : people),
        [people, needle],
    );

    if (shown.length === 0) {
        return <p className="text-sm text-muted">{m.scores_empty()}</p>;
    }

    return (
        <ul className="divide-y divide-line-faint">
            {shown.map((person) => (
                <li key={person.slug} className="flex items-baseline justify-between gap-3 py-1.5">
                    <Link
                        to={`/person/${person.slug}`}
                        className={`min-w-0 truncate ${linkClasses}`}
                    >
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

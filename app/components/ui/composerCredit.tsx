// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { canonicalPeople, personSlug } from "../../../core/person";
import { LocalizedLink as Link } from "./localizedLink";

// Who wrote a piece, as everywhere that says so should say it.
//
// A credit names more than one person often enough to matter — a chorale melody and the
// setting of it, a transcription that kept both names, three people who scored a game
// between them. The catalogue has always known how to read those: `canonicalPeople`
// splits them, and a piece credited to two composers appears on both of their pages.
// What said otherwise was the display, which printed the joined string and linked it to
// whichever name happened to come first — so a reader saw a composer called
// "Bartholomäus Gesius / Georg Philipp Telemann" and could reach only one of them.
//
// Names are cleaned on the way through, so a credit that arrived with a work number or
// an arranger welded to it reads as the person alone.

type ComposerCreditProps = {
    // The credit exactly as the catalogue holds it.
    composer: string;
    className?: string;
    linkClassName?: string;
};

export function ComposerCredit({ composer, className, linkClassName }: ComposerCreditProps) {
    const people = canonicalPeople(composer);
    if (people.length === 0) {
        return null;
    }
    return (
        <span className={className}>
            {people.map((name, at) => {
                const slug = personSlug(name);
                return (
                    // Keyed by name: two people in one credit are two different names, and
                    // a credit that repeats one is a credit with a duplicate to fix rather
                    // than a list to reorder.
                    <span key={name}>
                        {at > 0 && <span aria-hidden="true">, </span>}
                        {slug ? (
                            <Link to={`/person/${slug}`} className={linkClassName}>
                                {name}
                            </Link>
                        ) : (
                            // A credit naming a tradition rather than a person is still a
                            // credit, and still gets cleaned — one that skipped this printed
                            // a harvested score's "Traditional I think" into the library.
                            name
                        )}
                    </span>
                );
            })}
        </span>
    );
}

// The same names as one plain string, for the places that cannot hold an element: a meta
// description, structured data, the credit burnt into an exported video. Those carried the
// raw credit until now, so a piece whose page read "Carl Czerny" had a `<meta>` describing
// it as "C. Czerny Op.599 No.1".
export function composerCreditText(composer: string): string {
    return canonicalPeople(composer).join(", ");
}

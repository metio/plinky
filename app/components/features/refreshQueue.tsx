// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { type ItemKind, practiceHref } from "../../../core/practisable";
import { usePrefs } from "../../hooks/usePrefs";
import { buttonClasses } from "../ui/button";
import { BakedIncipit } from "../ui/incipit";
import { linkClasses, sectionHeadingClasses } from "../ui/classes";
import { LocalizedLink as Link } from "../ui/localizedLink";
import { m } from "../../paraglide/messages.js";

// The single refresh queue: the pieces due a replay to stay fresh, with the
// guided review session as the primary way through them. Empty reads as praise,
// not absence — but it still explains what reviews are and leaves the session
// reachable, because a player with nothing due yet is exactly the one who has
// never met the feature, and this is its only entry point.
export function RefreshQueue({
    reviews,
    headed = true,
}: {
    reviews: Array<{ id: string; title: string; kind: ItemKind; incipit?: string }>;
    // Whether the panel draws its own heading. The Stats page heads each of its questions
    // once and gathers the answers beneath, so a panel answering one of them must not
    // restate its name — two headings for one thing is what made that page read as a stack
    // of sections rather than a set of answers. Everywhere else it still names itself.
    headed?: boolean;
}) {
    // The reading aid that colours noteheads in a score colours these opening bars
    // too, read once for the whole list rather than per mark.
    const { prefs } = usePrefs();
    const due = reviews.length > 0;
    return (
        <section className="space-y-2">
            {headed && <h2 className={sectionHeadingClasses}>{m.grades_refresh_heading()}</h2>}
            {!due && <p className="text-sm text-muted">{m.grades_all_fresh()}</p>}
            <p className="text-sm text-muted">{m.refresh_why()}</p>
            {due ? (
                <>
                    <Link to="/review" className={buttonClasses("primary")}>
                        {m.review_start({ count: reviews.length })}
                    </Link>
                    <ul className="space-y-1 text-sm">
                        {reviews.map((review) => (
                            <li key={review.id} className="flex items-center gap-2">
                                {/* What is fading, drawn: the opening bars are the
                                    quickest way to remember which piece this was. */}
                                <BakedIncipit
                                    mark={review.incipit}
                                    label={review.title}
                                    colored={prefs.colorNotes}
                                    className="shrink-0 text-faint"
                                />
                                <Link to={practiceHref(review)} className={linkClasses}>
                                    {review.title}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </>
            ) : (
                // A quiet link rather than a primary button: there is nothing to clear
                // here yet, so this invites a look — it is not a task waiting to be done.
                <Link to="/review" className={`text-sm ${linkClasses}`}>
                    {m.review_explore()}
                </Link>
            )}
        </section>
    );
}

// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { buttonClasses } from "../ui/button";
import { linkClasses } from "../ui/classes";
import { LocalizedLink as Link } from "../ui/localizedLink";
import { m } from "../../paraglide/messages.js";

// The single refresh queue: the pieces due a replay to stay fresh, with the
// guided review session as the primary way through them. Empty reads as praise,
// not absence.
export function RefreshQueue({ reviews }: { reviews: Array<{ id: string; title: string }> }) {
    return (
        <section className="space-y-2">
            <h2 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {m.grades_refresh_heading()}
            </h2>
            {reviews.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">{m.grades_all_fresh()}</p>
            ) : (
                <>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{m.refresh_why()}</p>
                    <Link to="/review" className={buttonClasses("primary")}>
                        {m.review_start({ count: reviews.length })}
                    </Link>
                    <ul className="space-y-1 text-sm">
                        {reviews.map((review) => (
                            <li key={review.id}>
                                <Link to={`/play/${review.id}`} className={linkClasses}>
                                    {review.title}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </section>
    );
}

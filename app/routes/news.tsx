// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { PageHeader } from "../components/ui/pageHeader";
import { headingFor, type Release } from "../../core/changelog";
import { LATEST_RELEASES } from "../../core/newsLatest";
import { type Part, paragraphs } from "../../core/newsMarkup";
import { routeMeta } from "../../core/site";
import { INTER_LATIN, fontPreload, interSubsetFor } from "../lib/fontPreload";
import { useAsyncEffect } from "../hooks/useAsyncEffect";
import { useNewsSource } from "../contexts/services";
import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import type { Route } from "./+types/news";

// What changed, on the site rather than in a file on a code-hosting service.
//
// Plinky has no versions and no releases, so the changelog is the only record of what
// happened and when — and it lived in NEWS.md, which a player has to leave the site to
// read. The page ships with the newest releases in its own document and fetches the rest.

export function meta(_args: Route.MetaArgs) {
    return routeMeta(m.news_title(), m.meta_news_description());
}

// The entries are written in English on every page of the site — there is one changelog,
// not twenty-six — so this page's body text is drawn from the Latin subset whatever
// language its headings and chrome are in. Every other page's text is the reader's own
// language, which is why this is asked for here rather than in the root.
//
// Without it the subset is discovered from the stylesheet, and the page repaints in a
// fallback first: on a Greek run that was a single shift of 0.157 against a budget of 0.1,
// because a page of dense prose has a whole viewport of it to move.
export const links: Route.LinksFunction = () =>
    interSubsetFor(getLocale()) === INTER_LATIN ? [] : [fontPreload(INTER_LATIN)];

function Inline({ parts }: { parts: Part[] }) {
    return (
        <>
            {parts.map((part, index) => {
                // The parts of one paragraph, which has no id of its own to key on: the
                // list is rebuilt from the same string every render, so the index is the
                // identity here rather than a stand-in for one.
                const key = `${part.kind}:${index}:${part.text}`;
                if (part.kind === "bold") {
                    return <strong key={key}>{part.text}</strong>;
                }
                if (part.kind === "code") {
                    return (
                        <code key={key} className="rounded bg-subtle px-1 text-[0.9em]">
                            {part.text}
                        </code>
                    );
                }
                if (part.kind === "link") {
                    return (
                        <a
                            key={key}
                            href={part.href}
                            className="font-medium text-accent-strong hover:underline"
                        >
                            {part.text}
                        </a>
                    );
                }
                return <span key={key}>{part.text}</span>;
            })}
        </>
    );
}

export default function NewsRoute() {
    const news = useNewsSource();
    // The document ships with the newest releases, so the page has its content before
    // anything is fetched — and keeps them if the fetch never lands.
    const [releases, setReleases] = useState<Release[]>(LATEST_RELEASES);

    useAsyncEffect(
        (alive) => {
            news.releases().then((all) => {
                if (alive() && all && all.length > 0) {
                    setReleases(all);
                }
            });
        },
        [news.releases],
    );

    return (
        <main className="mx-auto max-w-3xl space-y-8 p-6 font-sans">
            <PageHeader title={m.news_title()} hint={m.news_intro()} />

            {/* One changelog, written in English, on a page whose chrome is in the
                reader's language. Saying so is what stops a screen reader pronouncing
                English prose by Greek or Russian rules, and it tells the browser which
                script the text below is in. */}
            <div lang="en" className="space-y-10">
                {releases.map((release) => (
                    <section key={`${release.date}:${release.label ?? ""}`} className="space-y-3">
                        <h2 className="font-semibold text-lg">
                            <time dateTime={release.date}>{headingFor(release)}</time>
                        </h2>
                        <div className="space-y-4">
                            {release.entries.map((entry) => (
                                <div key={entry.body.slice(0, 80)} className="space-y-2">
                                    {paragraphs(entry.body).map((parts) => (
                                        <p
                                            key={parts.map((part) => part.text).join("")}
                                            className="text-muted text-sm leading-relaxed"
                                        >
                                            <Inline parts={parts} />
                                        </p>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </section>
                ))}
            </div>
        </main>
    );
}

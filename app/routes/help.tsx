// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect } from "react";
import { linkClasses } from "../components/ui/classes";
import { itemsForPage, paragraphs } from "../../core/help";
import type { HelpItem } from "../../core/help";
import { useHelp } from "../hooks/useHelp";
import { routeMeta, webPageData } from "../../core/site";
import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import type { Route } from "./+types/help";

export function meta(_args: Route.MetaArgs) {
    return [
        ...routeMeta(m.help_title(), m.meta_help_description()),
        {
            "script:ld+json": webPageData(
                m.help_title(),
                m.meta_help_description(),
                getLocale(),
                "/help/",
                "CollectionPage",
            ),
        },
    ];
}

// The app owns the help page's structure: one section per page of the app, in this
// order, each titled by a translated string (several reuse the nav labels so the
// help section reads with the same name as the page). The bundled help content
// (core/helpContent) supplies the item inside each section; a section with no item
// still renders, so the page mirrors the app regardless. The `key` is both the
// content's `pageKey` and the hash the header ? links to.
const SECTIONS: { key: string; title: () => string }[] = [
    { key: "gettingStarted", title: m.help_section_getting_started },
    { key: "home", title: m.nav_home },
    { key: "play", title: m.help_section_play },
    { key: "library", title: m.nav_library },
    { key: "daily", title: m.nav_daily },
    { key: "ear", title: m.ear_title },
    { key: "compose", title: m.nav_compose },
    { key: "assignments", title: m.help_section_assignments },
    { key: "you", title: m.nav_you },
    { key: "review", title: m.help_section_review },
    { key: "settings", title: m.nav_settings },
];

function HelpBlock({ item }: { item: HelpItem }) {
    return (
        <div className="space-y-3">
            {item.imageUrl && (
                <img
                    src={item.imageUrl}
                    alt={item.imageAlt ?? ""}
                    loading="lazy"
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-800"
                />
            )}
            <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                {paragraphs(item.text).map((para, index) => (
                    // Paragraphs are plain text in fixed order; index keys are stable.
                    // biome-ignore lint/suspicious/noArrayIndexKey: static, ordered text
                    <p key={index} className="whitespace-pre-line">
                        {para}
                    </p>
                ))}
            </div>
            {item.linkUrl && (
                <a
                    href={item.linkUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={`inline-block text-sm ${linkClasses}`}
                >
                    {m.help_learn_more()} →
                </a>
            )}
        </div>
    );
}

export default function Help() {
    const { loading, items } = useHelp(getLocale());

    // Land on the section for the page the reader came from: the header ? links to
    // /help#<pageKey>, but a client-router navigation doesn't scroll to the hash on
    // its own. Runs after the content renders so the target element exists.
    useEffect(() => {
        if (loading) {
            return;
        }
        const anchor = window.location.hash.slice(1);
        if (anchor) {
            document.getElementById(anchor)?.scrollIntoView();
        }
    }, [loading]);

    return (
        <main className="mx-auto max-w-3xl space-y-10 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">{m.help_title()}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">{m.help_intro()}</p>
            </header>

            {SECTIONS.map(({ key, title }) => {
                const blocks = itemsForPage(items, key);
                return (
                    <section key={key} id={key} className="scroll-mt-20 space-y-4">
                        <h2 className="border-b border-gray-200 pb-1 text-lg font-semibold dark:border-gray-800">
                            {title()}
                        </h2>
                        {blocks.length > 0 ? (
                            <div className="space-y-8">
                                {blocks.map((item) => (
                                    <HelpBlock key={item.id} item={item} />
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-400 dark:text-gray-500">
                                {loading ? m.help_loading() : m.help_empty()}
                            </p>
                        )}
                    </section>
                );
            })}
        </main>
    );
}

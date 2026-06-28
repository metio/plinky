// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { DiscoveryChecklist } from "../components/discoveryChecklist";
import { HeroKeyboard } from "../components/heroKeyboard";
import { BookIcon, ListIcon, NotesIcon } from "../components/icons";
import { HomeToday } from "../components/homeToday";
import { LocalizedLink as Link } from "../components/localizedLink";
import { socialMeta, structuredData } from "../lib/site";
import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import type { Route } from "./+types/home";

export function meta(_args: Route.MetaArgs) {
    // React Router renders the "script:ld+json" descriptor as a JSON-LD <script>,
    // serializing it safely — no dangerouslySetInnerHTML needed.
    return [
        { title: m.meta_home_title() },
        { name: "description", content: m.meta_home_description() },
        ...socialMeta(m.meta_home_title(), m.meta_home_description()),
        { "script:ld+json": structuredData(getLocale()) },
    ];
}

// The things you can do, most-used first. The daily challenge is intentionally absent
// here — it lives in the Today panel above, so it isn't surfaced twice. One full-width
// card each, with room to actually explain the feature.
const FEATURES = [
    { to: "/library", label: m.home_browse_all, blurb: m.home_library_blurb, Icon: BookIcon },
    {
        to: "/assignments",
        label: m.home_assignments,
        blurb: m.home_assignments_blurb,
        Icon: ListIcon,
    },
    { to: "/compose", label: m.play_compose, blurb: m.play_compose_blurb, Icon: NotesIcon },
];

export default function Home() {
    return (
        <main className="mx-auto max-w-3xl space-y-12 p-6 font-sans">
            <section className="space-y-6 pt-2">
                <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700 dark:text-indigo-300">
                        {m.home_eyebrow()}
                    </p>
                    <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
                        {m.home_heading()}
                    </h1>
                    <p className="max-w-xl text-pretty leading-relaxed text-gray-600 dark:text-gray-300">
                        {m.home_intro()}
                    </p>
                </div>

                {/* Signature: a real keyboard you play right here, resting on a staff
                    line. The brand gradient glows behind it; the keys are the one
                    bold, characteristic thing on the page. */}
                <div className="space-y-2">
                    <div className="relative">
                        <div
                            aria-hidden="true"
                            className="pointer-events-none absolute -inset-x-6 -top-8 bottom-2 -z-10 bg-gradient-to-r from-indigo-500/15 via-violet-500/15 to-transparent blur-2xl"
                        />
                        <div
                            aria-hidden="true"
                            className="mx-auto mb-2 h-px max-w-md bg-gradient-to-r from-indigo-500 via-violet-500 to-transparent"
                        />
                        <HeroKeyboard />
                    </div>
                    <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                        {m.home_keyboard_hint()}
                    </p>
                </div>
            </section>

            <HomeToday />

            <DiscoveryChecklist />

            <section className="space-y-3">
                <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {m.home_explore_heading()}
                </h2>
                <div className="space-y-3">
                    {FEATURES.map((feature) => (
                        <Link
                            key={feature.to}
                            to={feature.to}
                            className="group flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-indigo-700"
                        >
                            <feature.Icon className="mt-0.5 h-8 w-8 shrink-0 text-indigo-600 group-hover:text-indigo-700 dark:text-indigo-400 dark:group-hover:text-indigo-300" />
                            <span className="space-y-1">
                                <span className="block text-lg font-medium text-gray-900 group-hover:text-indigo-700 dark:text-gray-100 dark:group-hover:text-indigo-300">
                                    {feature.label()} →
                                </span>
                                <span className="block text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                                    {feature.blurb()}
                                </span>
                            </span>
                        </Link>
                    ))}
                </div>
            </section>
        </main>
    );
}

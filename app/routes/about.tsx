// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { routeMeta, webPageData } from "../../core/site";
import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import type { Route } from "./+types/about";

export function meta(_args: Route.MetaArgs) {
    return [
        ...routeMeta(m.about_title(), m.meta_about_description()),
        {
            "script:ld+json": webPageData(
                m.about_title(),
                m.meta_about_description(),
                getLocale(),
                "/about/",
                "AboutPage",
            ),
        },
    ];
}

// The two founders, in the order the operation runs: Sol leads and gives Plinky
// its warmth; Sebastian builds it. Each title is kept in the founder's own
// language — "La Jefa" is Spanish (Sol is Mexican), "der Architekt" German
// (Sebastian is German) — so both are literals, like the names. Only the bios
// flow through paraglide.
const FOUNDERS = [
    {
        name: "Sol Herrera",
        role: "La Jefa",
        image: "/founder-marisol.webp",
        bio: m.about_sol_bio,
    },
    {
        name: "Sebastian Hoß",
        role: "der Architekt",
        image: "/founder-sebastian.webp",
        bio: m.about_sebastian_bio,
    },
] as const;

// A two-note "plink" — Plinky's own motif, and here a small duet standing in for
// the two people. Decorative, so it's hidden from assistive tech.
function DuetMark() {
    return (
        <span aria-hidden="true" className="inline-flex items-center gap-1 align-middle">
            <span className="h-1.5 w-6 rounded-full bg-accent-soft" />
            <span className="h-1.5 w-3 rounded-full bg-key-spent" />
        </span>
    );
}

export default function About() {
    // A hidden fondness: tapping Sol's portrait counts up, remounting the animated
    // bits so the peck replays each time. Zero on load means nothing animates until
    // someone finds it.
    const [kiss, setKiss] = useState(0);
    return (
        <main className="mx-auto max-w-3xl space-y-8 p-6 font-sans">
            {/* What Plinky is, kept somewhere it stays. The front page offers this to a
                first visit and then steps aside for the day's practice, which is right
                there and would leave a player who wanted to explain Plinky to somebody
                with nowhere to point. */}
            <header className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-strong">
                    {m.home_eyebrow()}
                </p>
                {/* The same display face every page's title is set in — this one keeps a
                    step of extra size on a wide screen, being the page that says what
                    Plinky is rather than one you work on. */}
                <h1 className="text-balance font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                    {m.home_heading()}
                </h1>
                <p className="text-pretty leading-relaxed text-muted">{m.home_intro()}</p>
            </header>

            <section className="space-y-4">
                <div className="space-y-2">
                    <h2 className="flex items-center gap-3 text-lg font-semibold">
                        {m.about_title()}
                        <DuetMark />
                    </h2>
                    <p className="text-sm text-muted">{m.about_intro()}</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    {FOUNDERS.map((founder, index) => {
                        // Sol leads (index 0): her portrait sparks the peck — she blushes
                        // and a kiss drifts up; Sebastian's card leans in from beside her.
                        const lead = index === 0;
                        const portrait = (
                            <img
                                key={kiss}
                                src={founder.image}
                                alt={founder.name}
                                width={112}
                                height={112}
                                loading="lazy"
                                className={`h-28 w-28 rounded-full bg-subtle object-cover ring-2 ring-accent-fill dark:ring-accent-fill/50 ${
                                    kiss > 0
                                        ? lead
                                            ? "motion-safe:animate-smooch"
                                            : "motion-safe:animate-lean"
                                        : ""
                                }`}
                            />
                        );
                        return (
                            <article
                                key={founder.name}
                                className="flex flex-col items-center gap-3 rounded-xl border border-line bg-raised p-6 text-center"
                            >
                                {lead ? (
                                    <button
                                        type="button"
                                        onClick={() => setKiss((count) => count + 1)}
                                        className="relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                                    >
                                        {portrait}
                                        {/* A rose blush blooms over her cheek. */}
                                        <span
                                            key={`blush-${kiss}`}
                                            aria-hidden="true"
                                            style={{
                                                background:
                                                    "radial-gradient(circle at 68% 62%, rgba(244,63,94,0.8), transparent 55%)",
                                            }}
                                            className={`pointer-events-none absolute inset-0 rounded-full opacity-0 mix-blend-multiply ${
                                                kiss > 0 ? "motion-safe:animate-blush" : ""
                                            }`}
                                        />
                                        {/* The peck, drifting up and away. */}
                                        <span
                                            key={`kiss-${kiss}`}
                                            aria-hidden="true"
                                            className={`pointer-events-none absolute right-3 top-6 text-xl opacity-0 ${
                                                kiss > 0 ? "motion-safe:animate-kiss" : ""
                                            }`}
                                        >
                                            💋
                                        </span>
                                    </button>
                                ) : (
                                    portrait
                                )}
                                <div className="space-y-1">
                                    <h2 className="text-lg font-semibold text-ink">
                                        {founder.name}
                                    </h2>
                                    <span className="inline-block rounded-full bg-accent-surface px-3 py-0.5 text-xs font-medium text-accent-strong">
                                        {founder.role}
                                    </span>
                                </div>
                                <p className="text-sm leading-relaxed text-muted">
                                    {founder.bio()}
                                </p>
                            </article>
                        );
                    })}
                </div>
            </section>

            <section className="space-y-3 border-t border-line pt-8">
                <h2 className="text-lg font-semibold">{m.about_why_title()}</h2>
                <p className="max-w-prose text-sm leading-relaxed text-muted">
                    {m.about_why_body()}
                </p>
            </section>

            <section className="space-y-3 border-t border-line pt-8">
                <h2 className="text-lg font-semibold">{m.about_contact_title()}</h2>
                <p className="max-w-prose text-sm leading-relaxed text-muted">
                    {m.about_contact_body()}
                </p>
                <a
                    href="mailto:contact@plinky.fun"
                    className="inline-block rounded-full bg-accent-surface px-4 py-1.5 text-sm font-medium text-accent-strong transition hover:bg-accent-fill"
                >
                    contact@plinky.fun
                </a>
            </section>
        </main>
    );
}

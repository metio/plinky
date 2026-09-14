// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FeatureBoundary } from "../components/features/featureBoundary";
import { HomeToday } from "../components/features/homeToday";
import { socialMeta, structuredData } from "../../core/site";
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

// Today: the day's practice in the shape a teacher gives an hour — warm up, work on
// something, learn one thing. The session itself reads local state, so it arrives
// after mount; the introduction below is in the static document for a first visit and
// for everything that reads the page without running it, and steps aside on a device
// that has played before (the root's pre-paint script stamps that, so the page never
// shows the introduction and then takes it away).
export default function Home() {
    return (
        <main className="mx-auto max-w-3xl space-y-8 p-6 font-sans">
            {/* Everything that arrives after mount sits at the foot of the page, so it
                lands in empty space instead of pushing the rest of it down. A page that
                rearranges itself while you are reading it is the one thing every visit
                would otherwise have in common. */}
            {/* What Plinky is, for a stranger and for anything reading the page without
                running it. The keyboard that used to sit here is in the warm-up now,
                where putting your hands on it is the first thing the day asks. */}
            <section className="space-y-3 returning:hidden">
                <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-strong">
                        {m.home_eyebrow()}
                    </p>
                    {/* Set like the About page's title, which is the same words in their
                        permanent home: a first visit meets them here, and anybody who
                        wants them again finds them there looking the same. */}
                    <h2 className="text-balance font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                        {m.home_heading()}
                    </h2>
                    <p className="text-pretty leading-relaxed text-muted">{m.home_intro()}</p>
                </div>
            </section>

            <FeatureBoundary feature="HomeToday">
                <HomeToday />
            </FeatureBoundary>
        </main>
    );
}

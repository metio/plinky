// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { DiscoveryChecklist } from "../components/features/discoveryChecklist";
import { FeatureBoundary } from "../components/features/featureBoundary";
import { HeroKeyboard } from "../components/features/heroKeyboard";
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
        <main className="mx-auto max-w-3xl space-y-10 p-6 font-sans">
            {/* Everything that arrives after mount sits at the foot of the page, so it
                lands in empty space instead of pushing the rest of it down. A page that
                rearranges itself while you are reading it is the one thing every visit
                would otherwise have in common. */}
            <section className="space-y-6 returning:hidden">
                <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-strong">
                        {m.home_eyebrow()}
                    </p>
                    <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
                        {m.home_heading()}
                    </h2>
                    <p className="text-pretty leading-relaxed text-muted">{m.home_intro()}</p>
                </div>

                {/* Signature: a real keyboard you play right here, resting on a staff
                    line. The brand gradient glows behind it; the keys are the one
                    bold, characteristic thing on the page. */}
                <div className="space-y-2">
                    <div className="relative">
                        <div
                            aria-hidden="true"
                            className="pointer-events-none absolute -inset-x-6 -top-8 bottom-2 -z-10 bg-gradient-to-r from-accent-ring/15 via-spark/15 to-transparent blur-2xl"
                        />
                        <div
                            aria-hidden="true"
                            className="mx-auto mb-2 h-px max-w-md bg-gradient-to-r from-accent-ring via-spark to-transparent"
                        />
                        <FeatureBoundary feature="HeroKeyboard">
                            <HeroKeyboard />
                        </FeatureBoundary>
                    </div>
                    <p className="text-center text-sm text-muted">{m.home_keyboard_hint()}</p>
                </div>
            </section>

            {/* Setting up a piano, a hand span and the keys tailors everything after it.
                None of it is a gate; it reconciles itself away as its steps complete. */}
            <FeatureBoundary feature="DiscoveryChecklist">
                <DiscoveryChecklist />
            </FeatureBoundary>

            <h1 className="text-2xl font-semibold">{m.today_heading()}</h1>

            <FeatureBoundary feature="HomeToday">
                <HomeToday />
            </FeatureBoundary>
        </main>
    );
}

// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { DiscoveryChecklist } from "../components/features/discoveryChecklist";
import { FeatureBoundary } from "../components/features/featureBoundary";
import { HeroKeyboard } from "../components/features/heroKeyboard";
import { BookIcon, EarIcon, ListIcon, NotesIcon } from "../components/ui/icons";
import { ArcadeCard } from "../components/features/arcadeCard";
import { HomeToday } from "../components/features/homeToday";
import { LocalizedLink as Link } from "../components/ui/localizedLink";
import { useSynth } from "../hooks/useSynth";
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

// The things you can do, most-used first. The daily challenge is intentionally absent
// here — it lives in the Today panel above, so it isn't surfaced twice. One full-width
// card each, with room to actually explain the feature.
// Each card carries a note of the C-major arpeggio, so mousing down the list
// plays a rising line — the page hums along with the browsing.
const FEATURES = [
    {
        to: "/library",
        label: m.home_browse_all,
        blurb: m.home_library_blurb,
        Icon: BookIcon,
        note: 60,
    },
    {
        to: "/assignments",
        label: m.home_assignments,
        blurb: m.home_assignments_blurb,
        Icon: ListIcon,
        note: 64,
    },
    {
        to: "/compose",
        label: m.play_compose,
        blurb: m.play_compose_blurb,
        Icon: NotesIcon,
        note: 67,
    },
    { to: "/ear", label: m.ear_title, blurb: m.home_ear_blurb, Icon: EarIcon, note: 72 },
];

export default function Home() {
    const synth = useSynth();
    return (
        <main className="mx-auto max-w-3xl space-y-12 p-6 font-sans">
            <section className="space-y-6 pt-2">
                <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-strong">
                        {m.home_eyebrow()}
                    </p>
                    <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
                        {m.home_heading()}
                    </h1>
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

            {/* The one front door for a new player: the Getting-started checklist sits
            in the prime slot the moment the page opens, prerendered for the common
            first visit. It reconciles itself away as its steps complete. */}
            <FeatureBoundary feature="DiscoveryChecklist">
                <DiscoveryChecklist />
            </FeatureBoundary>

            <FeatureBoundary feature="HomeToday">
                <HomeToday />
            </FeatureBoundary>

            <ArcadeCard />

            <section className="space-y-3">
                <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
                    {m.home_explore_heading()}
                </h2>
                <div className="space-y-3">
                    {FEATURES.map((feature) => (
                        <Link
                            key={feature.to}
                            to={feature.to}
                            // A soft plink on mouse hover only: touch fires pointerenter
                            // on every tap, which would double as a phantom key press.
                            // The synth already honours the sound/mute preference.
                            onPointerEnter={(event) => {
                                if (event.pointerType === "mouse") {
                                    synth.playNote(feature.note, {
                                        velocity: 55,
                                        duration: 0.4,
                                        decorative: true,
                                    });
                                }
                            }}
                            className="group flex items-start gap-4 rounded-xl border border-line bg-raised p-5 transition hover:-translate-y-0.5 hover:border-accent-line-strong hover:shadow-md"
                        >
                            <feature.Icon className="mt-0.5 h-8 w-8 shrink-0 text-accent group-hover:text-accent-strong" />
                            <span className="space-y-1">
                                <span className="block text-lg font-medium text-ink group-hover:text-accent-strong">
                                    {feature.label()} →
                                </span>
                                <span className="block text-sm leading-relaxed text-muted">
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

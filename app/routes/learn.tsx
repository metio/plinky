// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { HubList } from "../components/ui/hubList";
import {
    ArrowUpIcon,
    BookIcon,
    EarIcon,
    KeysIcon,
    ListIcon,
    MetronomeIcon,
    SlidersIcon,
} from "../components/ui/icons";
import { routeMeta, webPageData } from "../../core/site";
import { useSynth } from "../hooks/useSynth";
import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import type { Route } from "./+types/learn";

export function meta(_args: Route.MetaArgs) {
    return [
        ...routeMeta(m.nav_learn(), m.meta_learn_description()),
        {
            "script:ld+json": webPageData(
                m.nav_learn(),
                m.meta_learn_description(),
                getLocale(),
                "/learn/",
                "CollectionPage",
            ),
        },
    ];
}

// The schoolroom, in the order someone actually meets it: find the keys, learn how
// the music is built, look up what a mark means, train the ear that reads it, then
// the two reference benches and the test that says where you are.
//
// Every one of these used to be reachable only through a paragraph at the top of the
// Help page or the foot of the You page, which put a quarter of the app behind an
// icon that reads as support. Each entry carries the page's own title and opening
// line, so this list and the page it leads to always say the same thing.
//
// The notes climb a major scale, so running a mouse down the list plays it.
const ENTRIES = [
    { to: "/basics", label: m.basics_title, blurb: m.basics_intro, Icon: KeysIcon, note: 60 },
    { to: "/theory", label: m.theory_title, blurb: m.theory_intro, Icon: BookIcon, note: 62 },
    {
        to: "/glossary",
        label: m.glossary_title,
        blurb: m.glossary_intro,
        Icon: ListIcon,
        note: 64,
    },
    { to: "/ear", label: m.ear_title, blurb: m.home_ear_blurb, Icon: EarIcon, note: 65 },
    {
        to: "/methods",
        label: m.methods_title,
        blurb: m.methods_intro,
        Icon: MetronomeIcon,
        note: 67,
    },
    { to: "/tools", label: m.tools_title, blurb: m.tools_intro, Icon: SlidersIcon, note: 69 },
    {
        to: "/placement",
        label: m.placement_title,
        blurb: m.placement_intro,
        Icon: ArrowUpIcon,
        note: 71,
    },
];

export default function Learn() {
    const synth = useSynth();
    return (
        <main className="mx-auto max-w-3xl space-y-6 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">{m.nav_learn()}</h1>
                <p className="text-sm text-muted">{m.learn_intro()}</p>
            </header>

            <HubList
                entries={ENTRIES.map((entry) => ({
                    ...entry,
                    label: entry.label(),
                    blurb: entry.blurb(),
                }))}
                onEnter={(note) =>
                    synth.playNote(note, { velocity: 55, duration: 0.4, decorative: true })
                }
            />
        </main>
    );
}

// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { HubList } from "../components/ui/hubList";
import { SettingsSection } from "../components/ui/settingsSection";
import {
    ArrowUpIcon,
    BookIcon,
    EarIcon,
    KeysIcon,
    ListIcon,
    MetronomeIcon,
    SlidersIcon,
    UploadIcon,
} from "../components/ui/icons";
import { routeMeta, webPageData } from "../../core/site";
import { useSynth } from "../hooks/useSynth";
import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import type { Route } from "./+types/learn";
import { PageHeader } from "../components/ui/pageHeader";

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

// The schoolroom, in the order someone meets it: find the keys, learn how the music is
// built, look up what a mark means, train the ear that reads it — then the ways to work
// at it, the bench you reach for mid-practice, and the test that says where you are.
//
// Most of these used to be reachable only through a paragraph at the top of the Help
// page or the foot of the You page, which put a quarter of the app behind an icon that
// reads as support. Each entry carries the page's own title and opening line, so this
// list and the page it leads to always say the same thing.
//
// The notes climb an octave, so running a mouse down the list plays a scale.
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

// Setting work for somebody else is a different job from doing it, and it has two
// halves that never used to link to each other: the list you hand out, and the codes
// that come back. They sit together, under their own heading, rather than as a fifth
// place in the navigation — a teacher is a person, not a kind of thing to look for,
// and a permanent tab that is empty for almost everybody is the clutter this
// redesign is undoing. A set is also something plenty of players build for
// themselves, which is why it stays reachable here rather than behind a role.
const TEACHING = [
    {
        to: "/assignments",
        label: m.home_assignments,
        blurb: m.home_assignments_blurb,
        Icon: ListIcon,
        note: 72,
    },
    {
        to: "/collect",
        label: m.collect_title,
        blurb: m.collect_intro,
        Icon: UploadIcon,
        note: 74,
    },
];

export default function Learn() {
    const synth = useSynth();
    const play = (note: number) =>
        synth.playNote(note, { velocity: 55, duration: 0.4, decorative: true });
    return (
        <main className="mx-auto max-w-3xl space-y-8 p-6 font-sans">
            <PageHeader title={m.nav_learn()} hint={m.learn_intro()} />

            <HubList
                entries={ENTRIES.map((entry) => ({
                    ...entry,
                    label: entry.label(),
                    blurb: entry.blurb(),
                }))}
                onEnter={play}
            />

            <SettingsSection title={m.learn_teaching_heading()}>
                <HubList
                    entries={TEACHING.map((entry) => ({
                        ...entry,
                        label: entry.label(),
                        blurb: entry.blurb(),
                    }))}
                    onEnter={play}
                />
            </SettingsSection>
        </main>
    );
}

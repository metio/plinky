// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ListIcon, UploadIcon } from "../components/ui/icons";
import { HubList } from "../components/ui/hubList";
import { PageHeader } from "../components/ui/pageHeader";
import { routeMeta, webPageData } from "../../core/site";
import { useSynth } from "../hooks/useSynth";
import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import type { Route } from "./+types/teach";

export function meta(_args: Route.MetaArgs) {
    return [
        ...routeMeta(m.teach_title(), m.meta_teach_description()),
        {
            "script:ld+json": webPageData(
                m.teach_title(),
                m.meta_teach_description(),
                getLocale(),
                "/teach/",
                "CollectionPage",
            ),
        },
    ];
}

// Setting work for somebody else is a different job from doing it, and it has two halves
// that never used to link to each other: the list you hand out, and the codes that come
// back. A set is also something plenty of players build for themselves, so nothing here is
// gated behind being a teacher — the page simply gathers the making and the reading in one
// place instead of leaving them at the foot of somewhere else.
const ENTRIES = [
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

export default function TeachRoute() {
    const synth = useSynth();
    const play = (note: number) =>
        synth.playNote(note, { velocity: 55, duration: 0.4, decorative: true });
    return (
        <main className="mx-auto max-w-3xl space-y-8 p-6 font-sans">
            <PageHeader title={m.teach_title()} hint={m.teach_intro()} />

            <HubList
                entries={ENTRIES.map((entry) => ({
                    ...entry,
                    label: entry.label(),
                    blurb: entry.blurb(),
                }))}
                onEnter={play}
            />
        </main>
    );
}

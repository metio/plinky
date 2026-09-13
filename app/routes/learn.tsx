// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { type HubEntry, HubList } from "../components/ui/hubList";
import { routeMeta, webPageData } from "../../core/site";
import { LESSONS } from "../../core/theoryCourse";
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
// Read the keyboard, then the music, then the marks — and only then find where you stand,
// because the level a drill puts you at means little before you can read what it shows.
// The extras follow.
const ENTRIES: HubEntry[] = [
    { to: "/basics", label: m.basics_title, blurb: m.basics_intro, drawing: "keys" },
    {
        to: "/theory",
        label: m.theory_title,
        blurb: () => m.theory_intro({ count: LESSONS.length }),
        drawing: "staff",
    },
    { to: "/glossary", label: m.glossary_title, blurb: m.glossary_intro, drawing: "marks" },
    { to: "/placement", label: m.placement_title, blurb: m.placement_intro, drawing: "books" },
    { to: "/ear", label: m.ear_title, blurb: m.home_ear_blurb, drawing: "tuningFork" },
    { to: "/rhythm", label: m.rhythm_title, blurb: m.rhythm_intro, drawing: "rhythm" },
    { to: "/tools", label: m.tools_title, blurb: m.tools_intro, drawing: "pencil" },
];

export default function Learn() {
    return (
        <main className="mx-auto max-w-3xl space-y-8 p-6 font-sans">
            <PageHeader title={m.nav_learn()} hint={m.learn_intro()} />

            <HubList entries={ENTRIES} />
        </main>
    );
}

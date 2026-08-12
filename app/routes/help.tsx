// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect } from "react";
import { linkClasses } from "../components/ui/classes";
import { LocalizedLink as Link } from "../components/ui/localizedLink";
import { paragraphs } from "../../core/help";
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

// The help page, section by section, in the order a reader meets the app. Each
// section names the message holding its text and, where there is one, the picture
// of the page it describes.
//
// Content and app ship together: the text lives in the message catalogue like every
// other string, so `npm run messages:check` holds all 26 languages to the same set
// of keys, and the pictures are files in `public/help/`. A reader gets the help that
// belongs to the build they are running, offline included.
//
// The `key` is the hash the header's ? links to, so a section's anchor is its name.
const SECTIONS: {
    key: string;
    title: () => string;
    text: () => string;
    // File in public/help/, when the section has a picture of its page.
    image?: string;
    imageAlt?: () => string;
}[] = [
    { key: "intro", title: m.help_section_welcome, text: m.help_text_intro },
    {
        key: "gettingStarted",
        title: m.help_section_getting_started,
        text: m.help_text_getting_started,
        // Getting started and Home describe the same screen, so they share its picture.
        image: "home",
        imageAlt: m.help_shot_home,
    },
    {
        key: "home",
        title: m.nav_home,
        text: m.help_text_home,
        image: "home",
        imageAlt: m.help_shot_home,
    },
    {
        key: "play",
        title: m.help_section_play,
        text: m.help_text_play,
        image: "play",
        imageAlt: m.help_shot_play,
    },
    { key: "playSetup", title: m.help_section_play_setup, text: m.help_text_play_setup },
    { key: "playGrading", title: m.help_section_play_grading, text: m.help_text_play_grading },
    {
        key: "library",
        title: m.nav_library,
        text: m.help_text_library,
        image: "library",
        imageAlt: m.help_shot_library,
    },
    {
        key: "daily",
        title: m.nav_daily,
        text: m.help_text_daily,
        image: "daily",
        imageAlt: m.help_shot_daily,
    },
    {
        key: "ear",
        title: m.ear_title,
        text: m.help_text_ear,
        image: "ear",
        imageAlt: m.help_shot_ear,
    },
    {
        key: "compose",
        title: m.nav_compose,
        text: m.help_text_compose,
        image: "compose",
        imageAlt: m.help_shot_compose,
    },
    {
        key: "assignments",
        title: m.help_section_assignments,
        text: m.help_text_assignments,
        image: "assignments",
        imageAlt: m.help_shot_assignments,
    },
    {
        key: "you",
        title: m.nav_you,
        text: m.help_text_you,
        image: "you",
        imageAlt: m.help_shot_you,
    },
    {
        key: "review",
        title: m.help_section_review,
        text: m.help_text_review,
        image: "review",
        imageAlt: m.help_shot_review,
    },
    {
        key: "settings",
        title: m.nav_settings,
        text: m.help_text_settings,
        image: "settings",
        imageAlt: m.help_shot_settings,
    },
    { key: "extras", title: m.help_section_extras, text: m.help_text_extras },
];

function HelpBlock({ section }: { section: (typeof SECTIONS)[number] }) {
    return (
        <div className="space-y-3">
            {section.image && (
                <img
                    src={`/help/${section.image}.webp`}
                    alt={section.imageAlt?.() ?? ""}
                    loading="lazy"
                    className="w-full rounded-lg border border-line"
                />
            )}
            <div className="space-y-2 text-sm text-body">
                {paragraphs(section.text()).map((para, index) => (
                    // Paragraphs are plain text in fixed order; index keys are stable.
                    // biome-ignore lint/suspicious/noArrayIndexKey: static, ordered text
                    <p key={index} className="whitespace-pre-line">
                        {para}
                    </p>
                ))}
            </div>
        </div>
    );
}

export default function Help() {
    // Land on the section for the page the reader came from: the header ? links to
    // /help#<pageKey>, but a client-router navigation doesn't scroll to the hash on
    // its own.
    useEffect(() => {
        const anchor = window.location.hash.slice(1);
        if (anchor) {
            document.getElementById(anchor)?.scrollIntoView();
        }
    }, []);

    return (
        <main className="mx-auto max-w-3xl space-y-10 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">{m.help_title()}</h1>
                <p className="text-sm text-muted">{m.help_intro()}</p>
            </header>

            <p className="text-sm text-body">
                {m.help_glossary_lead()}{" "}
                <Link to="/glossary/" className={linkClasses}>
                    {m.glossary_title()}
                </Link>
            </p>

            {/* The theory the glossary assumes: it says what a mark means, this says
                why the music is built that way. Reached from here rather than from the
                home page, because it is something you come looking for. */}
            <p className="text-sm text-body">
                {m.help_theory_lead()}{" "}
                <Link to="/theory/" className={linkClasses}>
                    {m.theory_title()}
                </Link>
            </p>

            {/* The small look-it-up things — a circle of fifths, a scale, a tempo read
                off your own tapping. They belong beside the glossary: both answer a
                question that comes up in the middle of practising. */}
            <p className="text-sm text-body">
                {m.help_tools_lead()}{" "}
                <Link to="/tools/" className={linkClasses}>
                    {m.tools_title()}
                </Link>
            </p>

            {/* The keyboard tour's only other door is the home checklist, which goes away
                once it is dismissed or finished — so this is where it stays findable, and
                where someone comes back to it having forgotten where middle C was. */}
            <p className="text-sm text-body">
                {m.help_basics_lead()}{" "}
                <Link to="/basics/" className={linkClasses}>
                    {m.basics_title()}
                </Link>
            </p>

            {SECTIONS.map((section) => (
                <section key={section.key} id={section.key} className="scroll-mt-20 space-y-4">
                    <h2 className="border-b border-line pb-1 text-lg font-semibold">
                        {section.title()}
                    </h2>
                    <HelpBlock section={section} />
                </section>
            ))}
        </main>
    );
}

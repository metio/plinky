// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect } from "react";
import { paragraphs } from "../../core/help";
import { routeMeta, webPageData } from "../../core/site";
import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import type { Route } from "./+types/help";
import { PageHeader } from "../components/ui/pageHeader";
import { sectionHeadingClasses } from "../components/ui/classes";

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
        title: m.nav_today,
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
        key: "music",
        title: m.music_title,
        text: m.help_text_music,
        image: "music",
        imageAlt: m.help_shot_music,
    },
    {
        key: "learn",
        title: m.nav_learn,
        text: m.help_text_learn,
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
        key: "stats",
        title: m.nav_stats,
        text: m.help_text_stats,
        image: "stats",
        imageAlt: m.help_shot_stats,
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
                // Every shot is captured at the same size by dev/help-screenshots, and
                // saying so reserves the space before the file arrives. Without it each
                // lazy-loaded picture pushes the rest of the page down as it lands, and
                // fifteen sections of that is a page that will not sit still.
                <img
                    // The picture is of the app in the reader's own language: help that
                    // describes a button by a name the screenshot beside it does not use
                    // is help that has to be translated twice by the person reading it.
                    // A reader only ever fetches their own, so twenty-six sets cost a
                    // visitor exactly what one did.
                    src={`/help/${getLocale()}/${section.image}.webp`}
                    alt={section.imageAlt?.() ?? ""}
                    loading="lazy"
                    width={1200}
                    height={750}
                    className="h-auto w-full rounded-lg border border-line"
                    // A locale whose pictures have not been taken yet falls back to the
                    // English ones rather than showing a broken image. The generator takes
                    // every locale, so this is for the window between adding a language
                    // and the next screenshot run — not a state anybody should stay in.
                    onError={(event) => {
                        const image = event.currentTarget;
                        const fallback = `/help/en/${section.image}.webp`;
                        if (!image.src.endsWith(fallback)) {
                            image.src = fallback;
                        }
                    }}
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
        <main className="mx-auto max-w-3xl space-y-8 p-6 font-sans">
            <PageHeader title={m.help_title()} hint={m.help_intro()} />

            {SECTIONS.map((section) => (
                <section key={section.key} id={section.key} className="scroll-mt-20 space-y-4">
                    <h2 className={sectionHeadingClasses}>{section.title()}</h2>
                    <HelpBlock section={section} />
                </section>
            ))}
        </main>
    );
}

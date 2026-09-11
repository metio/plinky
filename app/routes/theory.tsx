// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TheoryIndex } from "../components/features/theoryIndex";

import { CIRCLE, signatureNotes } from "../../core/circleOfFifths";
import { breadcrumbData, routeMeta, webPageData } from "../../core/site";
import { noteNameOf } from "../../core/theory";
import { useNoteNaming } from "../hooks/useNoteNaming";
import { noteText, opening } from "../lib/noteNames";
import {
    type Demo,
    type Lesson,
    LESSONS,
    lessonById,
    lessonsIn,
    UNITS,
    type UnitId,
} from "../../core/theoryCourse";
import { buildSnippet } from "../../core/glossaryScore";
import { demoMoments, demoSnippet } from "../../core/theoryDemo";
import { FeatureBoundary } from "../components/features/featureBoundary";
import { NotationExample } from "../components/features/notationExample";
import { SoundingKeyboard } from "../components/features/soundingKeyboard";
import { useTheoryStore } from "../contexts/services";
import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import { useParams } from "react-router";
import type { Route } from "./+types/theory";
import { linkClasses } from "../components/ui/classes";
import { LinkedText, slot } from "../components/ui/linkedText";
import { LocalizedLink } from "../components/ui/localizedLink";
import { PageHeader } from "../components/ui/pageHeader";
import { Card } from "../components/ui/card";

export function meta({ params }: Route.MetaArgs) {
    const locale = getLocale();
    // One lesson's own page. Every one of them is prerendered, so this is what a reader
    // and a crawler are handed before any script runs — and what the app renders over on
    // hydration, so the two say the same thing by construction.
    const lesson = params.lesson ? lessonById(params.lesson) : null;
    if (lesson) {
        const title = LESSON_TITLE[lesson.id]?.() ?? "";
        const body = LESSON_BODY[lesson.id]?.() ?? "";
        return [
            ...routeMeta(title, body),
            {
                "script:ld+json": webPageData(
                    title,
                    body,
                    locale,
                    `/theory/${lesson.id}/`,
                    "LearningResource",
                ),
            },
            {
                "script:ld+json": breadcrumbData(locale, [
                    { name: m.nav_today(), path: "/" },
                    { name: m.theory_title(), path: "/theory/" },
                    { name: title, path: `/theory/${lesson.id}/` },
                ]),
            },
        ];
    }
    return [
        ...routeMeta(m.theory_title(), m.meta_theory_description()),
        {
            "script:ld+json": webPageData(
                m.theory_title(),
                m.meta_theory_description(),
                locale,
                "/theory/",
                "WebPage",
            ),
        },
    ];
}

const UNIT_NAME: Record<UnitId, () => string> = {
    reading: () => m.theory_unit_reading(),
    keys: () => m.theory_unit_keys(),
    harmony: () => m.theory_unit_harmony(),
};

const LESSON_TITLE: Record<string, () => string> = {
    staff: () => m.theory_staff_title(),
    values: () => m.theory_values_title(),
    rests: () => m.theory_rests_title(),
    bass: () => m.theory_bass_title(),
    relative: () => m.theory_relative_title(),
    family: () => m.theory_family_title(),
    cadence: () => m.theory_cadence_title(),
    steps: () => m.theory_steps_title(),
    octave: () => m.theory_octave_title(),
    major: () => m.theory_major_title(),
    minor: () => m.theory_minor_title(),
    signature: () => m.theory_signature_title(),
    triads: () => m.theory_triads_title(),
    colour: () => m.theory_colour_title(),
};

// The number a lesson shows, walked once from the same order the page renders, so the
// index and the card can never disagree about which lesson four is.
const LESSON_NUMBER = new Map(
    UNITS.flatMap((unit) => lessonsIn(unit)).map((lesson, at) => [lesson.id, at + 1]),
);

// Where the course opens. A lesson is written to be read after the one before it, so the
// first is the one to land on when the address names none.
const FIRST = LESSONS[0] as Lesson;

const LESSON_BODY: Record<string, () => string> = {
    staff: () => m.theory_staff_body(),
    values: () => m.theory_values_body(),
    rests: () => m.theory_rests_body(),
    bass: () => m.theory_bass_body(),
    relative: () => m.theory_relative_body(),
    family: () => m.theory_family_body(),
    cadence: () => m.theory_cadence_body(),
    steps: () => m.theory_steps_body(),
    octave: () => m.theory_octave_body(),
    major: () => m.theory_major_body(),
    minor: () => m.theory_minor_body(),
    signature: () => m.theory_signature_body(),
    triads: () => m.theory_triads_body(),
    colour: () => m.theory_colour_body(),
};

function LessonDemo({ demo, onPlay }: { demo: Demo; onPlay: () => void }) {
    const key = demo.circle !== undefined ? CIRCLE.find((one) => one.tonic === demo.circle) : null;
    const naming = useNoteNaming();
    return (
        <SoundingKeyboard
            score={demo}
            from={demo.from}
            to={demo.to}
            label={demoMoments(demo).length > 1 ? m.theory_hear_them() : m.theory_hear_it()}
            onPlay={onPlay}
        >
            {key && (
                <p className="text-sm text-muted">
                    {opening(
                        m.theory_signature_reads({
                            key: noteText(noteNameOf(key.tonic, key.spelling), naming),
                            notes: signatureNotes(key)
                                .map((name) => noteText(name, naming))
                                .join(" · "),
                        }),
                        naming,
                    )}
                </p>
            )}
        </SoundingKeyboard>
    );
}

function LessonCard({ lesson, index }: { lesson: Lesson; index: number }) {
    const theory = useTheoryStore();
    return (
        // The id is what the day's practice points at when it offers the next lesson,
        // so the reader lands on the lesson rather than on the top of the course.
        <li id={lesson.id} className="scroll-mt-20">
            <Card className="space-y-3">
                <div className="flex flex-wrap items-baseline gap-x-3">
                    <span className="font-mono text-xs tabular-nums text-muted">{index}</span>
                    {/* Level two, not three. The unit headings that used to sit between
                        this and the page title are gone with the fourteen-lesson scroll,
                        so a third level here skips one — which is what the axe sweep
                        reports and what a screen reader's outline actually loses. */}
                    <h2 className="text-base font-semibold text-ink">
                        {LESSON_TITLE[lesson.id]?.()}
                    </h2>
                </div>
                <p className="max-w-prose text-sm leading-relaxed text-body">
                    {LESSON_BODY[lesson.id]?.()}
                </p>
                {/* Hearing the idea is what meeting the lesson means, so playing it is what
                records it — there is nothing to tick, and the course never asks the
                reader to mark their own homework. */}
                {/* The engraver is the one part of a lesson that can fail on its own: it
                    parses a score and drives a renderer, where everything else here is
                    copy and a table. A lesson that cannot draw its example is still a
                    lesson worth reading, and the same boundary guards the same component
                    on the glossary page. */}
                <FeatureBoundary feature="NotationExample">
                    <NotationExample
                        xml={buildSnippet(demoSnippet(lesson.demo))}
                        label={LESSON_TITLE[lesson.id]?.() ?? ""}
                    />
                </FeatureBoundary>
                <LessonDemo demo={lesson.demo} onPlay={() => theory.markMet(lesson.id)} />
            </Card>
        </li>
    );
}

// The theory under the page: what a stave encodes, why a piece carries sharps, and
// what makes a chord sound the way it does. Each lesson is a paragraph and
// something to play — the glossary says what a mark means, this says why the music is
// built that way.
export default function TheoryRoute() {
    // The address IS the state, the same way it is on the glossary. /theory opens the
    // first lesson, because that is where a course starts and an empty frame beside a
    // list of fourteen titles teaches nobody anything.
    //
    // One lesson at a time, rather than all fourteen down one page. Every lesson is
    // prerendered at its own address; rendering them here as well put each one at two
    // addresses, and of the two the index is the stronger page — so the course competed
    // with itself for exactly the question a single lesson exists to answer.
    const params = useParams();
    const lesson = (params.lesson ? lessonById(params.lesson) : null) ?? FIRST;
    // Whether the address names one lesson. The head for it is written by meta() above,
    // which the prerendered document and the running app both go through.
    const onLesson = params.lesson !== undefined && lessonById(params.lesson) !== null;
    return (
        // Wider than the rest of the app, and two columns, for the same reason the
        // glossary is: an index down the side needs the room.
        <main className="mx-auto max-w-4xl space-y-6 p-6 font-sans">
            <PageHeader
                eyebrow={onLesson ? UNIT_NAME[lesson.unit]() : undefined}
                title={onLesson ? (LESSON_TITLE[lesson.id]?.() ?? "") : m.theory_title()}
                // No hint on a lesson's own page, for the reason the glossary has none:
                // the card below opens with this exact paragraph.
                hint={onLesson ? undefined : m.theory_intro({ count: LESSONS.length })}
            />

            <div className="grid gap-6 md:grid-cols-[14rem_1fr]">
                <TheoryIndex titles={LESSON_TITLE} numbers={LESSON_NUMBER} selected={lesson.id} />
                <ul className="space-y-4">
                    {/* A fresh card per lesson. Every lesson's address is this one route,
                        so moving between two keeps the page mounted, and an unkeyed card
                        would hand the next lesson the last one's engraver and demo. */}
                    <LessonCard
                        key={lesson.id}
                        lesson={lesson}
                        index={LESSON_NUMBER.get(lesson.id) ?? 1}
                    />
                </ul>
            </div>

            <p className="text-sm text-muted">
                <LinkedText
                    text={m.theory_outro({
                        glossary: slot("glossary"),
                        tools: slot("tools"),
                    })}
                    links={{
                        glossary: (
                            <LocalizedLink to="/glossary" className={linkClasses}>
                                {m.glossary_title()}
                            </LocalizedLink>
                        ),
                        tools: (
                            <LocalizedLink to="/tools" className={linkClasses}>
                                {m.tools_title()}
                            </LocalizedLink>
                        ),
                    }}
                />
            </p>
        </main>
    );
}

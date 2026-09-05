// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TheoryIndex } from "../components/features/theoryIndex";

import { CIRCLE, signatureNotes } from "../../core/circleOfFifths";
import { routeMeta, webPageData } from "../../core/site";
import { NOTE_TEXT, noteNameOf } from "../../core/theory";
import {
    type Demo,
    type Lesson,
    LESSONS,
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
import type { Route } from "./+types/theory";
import { linkClasses, sectionHeadingClasses } from "../components/ui/classes";
import { LinkedText, slot } from "../components/ui/linkedText";
import { LocalizedLink } from "../components/ui/localizedLink";
import { PageHeader } from "../components/ui/pageHeader";
import { Card } from "../components/ui/card";
import { useScrollToHash } from "../hooks/useScrollToHash";

export function meta(_args: Route.MetaArgs) {
    return [
        ...routeMeta(m.theory_title(), m.meta_theory_description()),
        {
            "script:ld+json": webPageData(
                m.theory_title(),
                m.meta_theory_description(),
                getLocale(),
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
                    {m.theory_signature_reads({
                        key: NOTE_TEXT[noteNameOf(key.tonic, key.spelling)],
                        notes: signatureNotes(key)
                            .map((name) => NOTE_TEXT[name])
                            .join(" · "),
                    })}
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
                    <h3 className="text-base font-semibold text-ink">
                        {LESSON_TITLE[lesson.id]?.()}
                    </h3>
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
    // The day's practice links to a single lesson; a client-router navigation does not
    // scroll to a hash on its own.
    useScrollToHash();
    let counter = 0;
    return (
        // Wider than the rest of the app, and two columns, for the same reason the
        // glossary is: an index down the side needs the room. The course still reads top
        // to bottom; the index is for coming BACK to a lesson, not for taking them out of
        // order.
        <main className="mx-auto max-w-4xl space-y-8 p-6 font-sans">
            <PageHeader title={m.theory_title()} hint={m.theory_intro({ count: LESSONS.length })} />

            <div className="grid gap-6 md:grid-cols-[14rem_1fr]">
                <TheoryIndex titles={LESSON_TITLE} numbers={LESSON_NUMBER} />
                <div className="space-y-8">
                    {UNITS.map((unit) => (
                        <section key={unit} className="space-y-3">
                            <h2 className={sectionHeadingClasses}>{UNIT_NAME[unit]()}</h2>
                            <ul className="space-y-4">
                                {lessonsIn(unit).map((lesson) => {
                                    counter += 1;
                                    return (
                                        <LessonCard
                                            key={lesson.id}
                                            lesson={lesson}
                                            index={counter}
                                        />
                                    );
                                })}
                            </ul>
                        </section>
                    ))}
                </div>
            </div>

            <p className="text-sm text-muted">
                <LinkedText
                    text={m.theory_outro({
                        count: LESSONS.length,
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

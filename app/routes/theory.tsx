// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect } from "react";

import { CIRCLE, signatureNotes } from "../../core/circleOfFifths";
import { routeMeta, webPageData } from "../../core/site";
import { NOTE_TEXT, noteNameOf, scalePitches } from "../../core/theory";
import { chordPitches } from "../../core/theory";
import {
    type Demo,
    type Lesson,
    LESSONS,
    lessonsIn,
    UNITS,
    type UnitId,
} from "../../core/theoryCourse";
import { DEMO_FROM, SoundingKeyboard } from "../components/features/soundingKeyboard";
import { useTheoryStore } from "../contexts/services";
import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import type { Route } from "./+types/theory";
import { sectionHeadingClasses } from "../components/ui/classes";
import { PageHeader } from "../components/ui/pageHeader";
import { Card } from "../components/ui/card";

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

// Middle C: where a lesson's tonic sits, matching the register the shared demo draws.
const KEY_FROM = DEMO_FROM;
// The pause between the two halves of a comparison: long enough that they are heard as
// two things rather than one, short enough to hold both in the ear at once.
const COMPARE_GAP_MS = 900;

const UNIT_NAME: Record<UnitId, () => string> = {
    reading: () => m.theory_unit_reading(),
    keys: () => m.theory_unit_keys(),
    harmony: () => m.theory_unit_harmony(),
};

const LESSON_TITLE: Record<string, () => string> = {
    staff: () => m.theory_staff_title(),
    steps: () => m.theory_steps_title(),
    octave: () => m.theory_octave_title(),
    major: () => m.theory_major_title(),
    minor: () => m.theory_minor_title(),
    signature: () => m.theory_signature_title(),
    triads: () => m.theory_triads_title(),
    colour: () => m.theory_colour_title(),
};

const LESSON_BODY: Record<string, () => string> = {
    staff: () => m.theory_staff_body(),
    steps: () => m.theory_steps_body(),
    octave: () => m.theory_octave_body(),
    major: () => m.theory_major_body(),
    minor: () => m.theory_minor_body(),
    signature: () => m.theory_signature_body(),
    triads: () => m.theory_triads_body(),
    colour: () => m.theory_colour_body(),
};

// Every demonstration comes down to "these notes, lit and playable" — one set at a
// time, or two in turn for a comparison. Resolving each demo to that shape here keeps
// the lesson components to one apiece instead of one per idea.
function litNotes(demo: Demo): number[] {
    switch (demo.kind) {
        case "keyboard":
            return demo.notes;
        case "scale":
            return scalePitches(demo.tonic, demo.scale);
        case "chord":
            return chordPitches(demo.root, demo.quality);
        case "compare":
            // Both halves at once: the lesson is about the difference between them, and
            // a keyboard showing only the first one draws the question without the
            // answer. In every comparison here the two overlap but for a key or two,
            // which is precisely what there is to see.
            return [...demo.first, ...demo.second];
        case "circle":
            return chordPitches(KEY_FROM + demo.tonic, "major");
    }
}

function LessonDemo({ demo, onPlay }: { demo: Demo; onPlay: () => void }) {
    const key = demo.kind === "circle" ? CIRCLE.find((one) => one.tonic === demo.tonic) : null;
    // A comparison plays the same idea twice — the second reading after a gap, so the
    // ear hears them as a pair rather than a single run.
    const phrases =
        demo.kind === "compare"
            ? [{ notes: demo.first }, { notes: demo.second, afterMs: COMPARE_GAP_MS }]
            : [{ notes: litNotes(demo), spread: demo.kind === "scale" }];

    return (
        <SoundingKeyboard
            lit={litNotes(demo)}
            phrases={phrases}
            label={demo.kind === "compare" ? m.theory_hear_both() : m.theory_hear_it()}
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
                <LessonDemo demo={lesson.demo} onPlay={() => theory.markMet(lesson.id)} />
            </Card>
        </li>
    );
}

// The theory under the page: what a stave encodes, why a piece carries sharps, and
// what makes a chord sound the way it does. Eight lessons, each one a paragraph and
// something to play — the glossary says what a mark means, this says why the music is
// built that way.
export default function TheoryRoute() {
    // The day's practice links to a single lesson; a client-router navigation does not
    // scroll to a hash on its own.
    useEffect(() => {
        const anchor = window.location.hash.slice(1);
        if (anchor) {
            document.getElementById(anchor)?.scrollIntoView();
        }
    }, []);
    let counter = 0;
    return (
        <main className="mx-auto max-w-3xl space-y-8 p-6 font-sans">
            <PageHeader title={m.theory_title()} hint={m.theory_intro()} />

            {UNITS.map((unit) => (
                <section key={unit} className="space-y-3">
                    <h2 className={sectionHeadingClasses}>{UNIT_NAME[unit]()}</h2>
                    <ul className="space-y-4">
                        {lessonsIn(unit).map((lesson) => {
                            counter += 1;
                            return <LessonCard key={lesson.id} lesson={lesson} index={counter} />;
                        })}
                    </ul>
                </section>
            ))}

            <p className="text-sm text-muted">{m.theory_outro({ count: LESSONS.length })}</p>
        </main>
    );
}

// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useCallback, useEffect, useRef } from "react";
import { CIRCLE, signatureNotes } from "../../core/circleOfFifths";
import { routeMeta, webPageData } from "../../core/site";
import { NOTE_TEXT, noteNameOf, type ScaleId, scalePitches } from "../../core/theory";
import { chordPitches, type ChordQuality } from "../../core/theory";
import {
    type Demo,
    type Lesson,
    LESSONS,
    lessonsIn,
    UNITS,
    type UnitId,
} from "../../core/theoryCourse";
import { Button } from "../components/ui/button";
import { Keyboard } from "../components/ui/keyboard";
import { useScheduler } from "../contexts/services";
import type { SchedulerHandle } from "../ports/scheduler";
import { useSynth } from "../hooks/useSynth";
import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import type { Route } from "./+types/theory";

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

const KEY_FROM = 60;
const KEY_TO = 84;
const NOTE_SECONDS = 0.5;
const STEP_MS = 320;
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
            return scalePitches(demo.tonic, demo.scale as ScaleId);
        case "chord":
            return chordPitches(demo.root, demo.quality as ChordQuality);
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

function LessonDemo({ demo }: { demo: Demo }) {
    const synth = useSynth();
    const scheduler = useScheduler();
    // Strikes still waiting to happen, so a comparison left half-played when the reader
    // moves on does not go on sounding, and a second press replaces the first.
    const pending = useRef<SchedulerHandle[]>([]);
    const stop = useCallback(() => {
        for (const handle of pending.current) {
            scheduler.cancel(handle);
        }
        pending.current = [];
    }, [scheduler]);
    useEffect(() => stop, [stop]);

    // A scale unfolds one note at a time; a chord sounds together. Both go through the
    // injected scheduler rather than a bare timer, which the architecture confines.
    const play = (notes: number[], atMs = 0, spread = false) => {
        for (const [index, pitch] of notes.entries()) {
            const at = atMs + (spread ? index * STEP_MS : 0);
            const strike = () => synth.playNote(pitch, { duration: NOTE_SECONDS });
            if (at === 0) {
                strike();
            } else {
                pending.current.push(scheduler.after(at, strike));
            }
        }
    };

    const hear = () => {
        stop();
        if (demo.kind === "compare") {
            play(demo.first);
            play(demo.second, COMPARE_GAP_MS);
            return;
        }
        play(litNotes(demo), 0, demo.kind === "scale");
    };

    const key = demo.kind === "circle" ? CIRCLE.find((one) => one.tonic === demo.tonic) : null;

    return (
        <div className="space-y-3">
            <Keyboard from={KEY_FROM} to={KEY_TO} lit={new Set(litNotes(demo))} labels="c" />
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
            <Button variant="secondary" onClick={hear}>
                {demo.kind === "compare" ? m.theory_hear_both() : m.theory_hear_it()}
            </Button>
        </div>
    );
}

function LessonCard({ lesson, index }: { lesson: Lesson; index: number }) {
    return (
        <li className="space-y-3 rounded-lg border border-line bg-surface p-4">
            <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-mono text-xs tabular-nums text-muted">{index}</span>
                <h3 className="font-medium text-body">{LESSON_TITLE[lesson.id]?.()}</h3>
            </div>
            <p className="max-w-prose text-sm leading-relaxed text-body">
                {LESSON_BODY[lesson.id]?.()}
            </p>
            <LessonDemo demo={lesson.demo} />
        </li>
    );
}

// The theory under the page: what a stave encodes, why a piece carries sharps, and
// what makes a chord sound the way it does. Eight lessons, each one a paragraph and
// something to play — the glossary says what a mark means, this says why the music is
// built that way.
export default function TheoryRoute() {
    let counter = 0;
    return (
        <main className="mx-auto max-w-3xl space-y-6 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">{m.theory_title()}</h1>
                <p className="text-sm text-muted">{m.theory_intro()}</p>
            </header>

            {UNITS.map((unit) => (
                <section key={unit} className="space-y-3">
                    <h2 className="text-sm font-medium text-body">{UNIT_NAME[unit]()}</h2>
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

// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Link } from "react-router";
import type { MusicItem } from "../../../core/music";
import { pickForGrade } from "../../../core/pickForGrade";
import { playOptionsQuery } from "../../../core/playOptions";
import type { MethodId, PracticeMethod } from "../../../core/practiceMethods";
import { useMusicItems } from "../../hooks/useMusicItems";
import { useServices } from "../../contexts/services";
import { Drawing, type DrawingName } from "../ui/drawings/drawing";
import { localizedHref } from "../ui/href";
import { m } from "../../paraglide/messages.js";

export const METHOD_NAME: Record<MethodId, () => string> = {
    chunking: () => m.method_chunking_name(),
    slow: () => m.method_slow_name(),
    handsApart: () => m.method_hands_apart_name(),
    hearingFirst: () => m.method_hearing_first_name(),
    interleaving: () => m.method_interleaving_name(),
    spacing: () => m.method_spacing_name(),
    chords: () => m.method_chords_name(),
};

// The method in a word or two, for the key it sits on: a key is narrower than a name.
export const METHOD_LABEL: Record<MethodId, () => string> = {
    chunking: () => m.method_chunking_short(),
    slow: () => m.method_slow_short(),
    handsApart: () => m.method_hands_apart_short(),
    hearingFirst: () => m.method_hearing_first_short(),
    interleaving: () => m.method_interleaving_short(),
    spacing: () => m.method_spacing_short(),
    chords: () => m.method_chords_short(),
};

const HOW: Record<MethodId, () => string> = {
    chunking: () => m.method_chunking_how(),
    slow: () => m.method_slow_how(),
    handsApart: () => m.method_hands_apart_how(),
    hearingFirst: () => m.method_hearing_first_how(),
    interleaving: () => m.method_interleaving_how(),
    spacing: () => m.method_spacing_how(),
    chords: () => m.method_chords_how(),
};

const WHY: Record<MethodId, () => string> = {
    chunking: () => m.method_chunking_why(),
    slow: () => m.method_slow_why(),
    handsApart: () => m.method_hands_apart_why(),
    hearingFirst: () => m.method_hearing_first_why(),
    interleaving: () => m.method_interleaving_why(),
    spacing: () => m.method_spacing_why(),
    chords: () => m.method_chords_why(),
};

// One drawing per method, each of something a pianist already owns: the loop over two bars,
// the metronome, half a keyboard, headphones, two pages swapped, a calendar, a triad.
export const METHOD_DRAWING: Record<MethodId, DrawingName> = {
    chunking: "loop",
    slow: "metronome",
    handsApart: "halfKeyboard",
    hearingFirst: "headphones",
    interleaving: "shuffledPages",
    spacing: "calendar",
    chords: "triad",
};

// One method's own button. It opens a piece at the player's grade with the method already
// set up — slowed down, one hand, looping the opening phrase — because a suggestion that
// ends at "go and find something" is advice rather than practice, and a library of three
// thousand pieces is a wall to the beginner this page is written for.
//
// The two methods that are not about a single piece point at the review queue instead.
// Handing somebody a random piece would be the exact opposite of "mix them up" and "come
// back to it later": the queue's whole job is choosing which piece and when.
//
// No button at all when the grade holds nothing to offer — a dead button that says "try
// this" and lands nowhere is worse than the reading alone.
function MethodAction({
    method,
    grade,
    items,
}: {
    method: PracticeMethod;
    grade: number;
    items: MusicItem[];
}) {
    if (method.route) {
        return (
            <Link
                to={localizedHref(method.route)}
                className="inline-block text-sm font-semibold text-accent-strong hover:underline"
            >
                {m.methods_review()}
            </Link>
        );
    }
    // A generated exercise needs no grade and no catalogue: it is always there to open.
    if (method.tile) {
        return (
            <Link
                to={localizedHref(`/play/${method.tile}`)}
                className="inline-block text-sm font-semibold text-accent-strong hover:underline"
            >
                {m.methods_chords_open()}
            </Link>
        );
    }
    // Seeded by the method, so each suggestion offers its own piece and none of them
    // changes under the reader on a re-render.
    const piece = pickForGrade(items, grade, method.id);
    if (!piece || !method.opens) return null;
    return (
        <Link
            to={localizedHref(`/play/${piece.id}${playOptionsQuery(method.opens)}`)}
            className="inline-block text-sm font-semibold text-accent-strong hover:underline"
        >
            {m.methods_try({ grade })}
        </Link>
    );
}

// One way to practise, opened: its drawing in the margin, then why it works, what Plinky
// gives you to do it with, how long a go at it takes, and a button that opens a piece with
// it already set up.
//
// The reason leads and the instruction follows, because somebody who does not yet know why
// looping two bars beats playing the piece again will not reach for the loop. The button is
// last: read, then do.
//
// A region named by the method's own heading. The front page's keys point at it, and a press
// fills it with that key's method; the leaf stays mounted as its method changes, so the
// catalogue below is assembled once however many keys are pressed.
export function MethodLeaf({ id, method }: { id: string; method: PracticeMethod }) {
    const services = useServices();
    // Read every render rather than memoised — a grade reached while the page is open
    // should change what the button offers.
    const grade = Math.max(1, services.milestones.reachedGrade());
    // The catalogue behind a button that opens a piece. Assembling it parses every score held
    // on the device and maps three thousand manifest rows, so it is read once, here.
    const { items } = useMusicItems();
    const heading = `${id}-name`;
    return (
        <section
            id={id}
            aria-labelledby={heading}
            className="grid items-start gap-4 pt-5 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-6"
        >
            <Drawing name={METHOD_DRAWING[method.id]} className="h-auto w-[84px] sm:w-24" />
            <div className="min-w-0 max-w-prose space-y-2.5">
                <h3 id={heading} className="font-display text-xl font-medium text-ink">
                    {METHOD_NAME[method.id]()}
                </h3>
                <p className="leading-relaxed text-body">{WHY[method.id]()}</p>
                <p className="leading-relaxed text-muted">
                    <span className="font-semibold text-body">{m.methods_in_plinky()}:</span>{" "}
                    {HOW[method.id]()}
                </p>
                <p className="text-sm text-muted first-letter:uppercase">
                    {m.methods_dose({ count: method.minutes })}
                </p>
                <MethodAction method={method} grade={grade} items={items} />
            </div>
        </section>
    );
}

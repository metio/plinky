// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Link } from "react-router";
import type { MusicItem } from "../../../core/music";
import { pickForGrade } from "../../../core/pickForGrade";
import { playOptionsQuery } from "../../../core/playOptions";
import { type MethodId, METHODS, type PracticeMethod } from "../../../core/practiceMethods";
import { useMusicItems } from "../../hooks/useMusicItems";
import { useServices } from "../../contexts/services";
import { HubCard } from "../ui/hubCard";
import { CalendarIcon, EarIcon, HandIcon, ListIcon, MetronomeIcon, RotateIcon } from "../ui/icons";
import { useSynth } from "../../hooks/useSynth";
import { localizedHref } from "../ui/href";
import { sectionHeadingClasses } from "../ui/classes";
import { m } from "../../paraglide/messages.js";

const NAME: Record<MethodId, () => string> = {
    chunking: () => m.method_chunking_name(),
    slow: () => m.method_slow_name(),
    handsApart: () => m.method_hands_apart_name(),
    hearingFirst: () => m.method_hearing_first_name(),
    interleaving: () => m.method_interleaving_name(),
    spacing: () => m.method_spacing_name(),
};

const HOW: Record<MethodId, () => string> = {
    chunking: () => m.method_chunking_how(),
    slow: () => m.method_slow_how(),
    handsApart: () => m.method_hands_apart_how(),
    hearingFirst: () => m.method_hearing_first_how(),
    interleaving: () => m.method_interleaving_how(),
    spacing: () => m.method_spacing_how(),
};

const WHY: Record<MethodId, () => string> = {
    chunking: () => m.method_chunking_why(),
    slow: () => m.method_slow_why(),
    handsApart: () => m.method_hands_apart_why(),
    hearingFirst: () => m.method_hearing_first_why(),
    interleaving: () => m.method_interleaving_why(),
    spacing: () => m.method_spacing_why(),
};

// One icon per method, so six of these in a column read as six things at a glance rather
// than as six paragraphs. Each is the nearest thing the icon set already has to what the
// method DOES: a loop for looping, a metronome for slowing down, a hand for one hand.
const ICONS: Record<MethodId, (props: { className?: string }) => React.JSX.Element> = {
    chunking: RotateIcon,
    slow: MetronomeIcon,
    handsApart: HandIcon,
    hearingFirst: EarIcon,
    interleaving: ListIcon,
    spacing: CalendarIcon,
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

// Six ways to practise: why each one works, what Plinky gives you to do it with, and a
// button that opens a piece with it already set up.
//
// The reason leads and the instruction follows, because somebody who does not yet know why
// looping two bars beats playing the piece again will not reach for the loop. The button is
// last: read, then do.
export function PracticeMethods() {
    const services = useServices();
    // Read every render rather than memoised — a grade reached while the page is open
    // should change what the buttons offer.
    const grade = Math.max(1, services.milestones.reachedGrade());
    // One catalogue for the six buttons. Assembling it parses every score held on the
    // device and maps three thousand manifest rows, so it is read here once and handed
    // down rather than rebuilt by each method for itself.
    const { items } = useMusicItems();
    // Each card sounds its note as a mouse crosses it, so running an eye down the six plays
    // a scale. The Learn hub's own idea, reached through the card they now share.
    const synth = useSynth();
    const sound = (note: number) =>
        synth.playNote(note, { velocity: 55, duration: 0.4, decorative: true });
    return (
        <section className="space-y-4">
            <h2 className={sectionHeadingClasses}>{m.methods_title()}</h2>
            <p className="text-sm text-muted">{m.methods_intro()}</p>

            <ul className="space-y-3">
                {METHODS.map((method) => (
                    <li key={method.id}>
                        {/* The same card the Learn hub is built from — bordered, raised and
                            lifting on hover — but not a link: this one carries its own
                            action button, and a link around a link is not a thing. */}
                        <HubCard Icon={ICONS[method.id]} note={method.note} onEnter={sound}>
                            <div className="min-w-0 space-y-2">
                                <div className="flex flex-wrap items-baseline gap-x-3">
                                    <h3 className="text-base font-semibold text-ink">
                                        {NAME[method.id]()}
                                    </h3>
                                    <span className="text-xs text-muted">
                                        {m.methods_dose({ count: method.minutes })}
                                    </span>
                                </div>
                                {/* The reason first: it is what makes the instruction worth
                                    following, and it is the half a beginner has never been
                                    told. */}
                                <p className="text-sm text-body">{WHY[method.id]()}</p>
                                <p className="text-sm text-muted">
                                    <span className="font-semibold text-body">
                                        {m.methods_in_plinky()}:
                                    </span>{" "}
                                    {HOW[method.id]()}
                                </p>
                                <MethodAction method={method} grade={grade} items={items} />
                            </div>
                        </HubCard>
                    </li>
                ))}
            </ul>
        </section>
    );
}

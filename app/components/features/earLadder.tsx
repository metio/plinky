// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { type IntervalId, semitonesOf } from "../../../core/theory";
import { intervalName } from "../../lib/theoryNames";
import { answerClasses, type Verdict } from "./earVerdict";
import { m } from "../../paraglide/messages.js";

// The answer surface for the interval exercise. An interval is a distance, so the choices
// are stacked in the order they sound — the octave at the top, the unison at the foot —
// and picking one is picking a height, which is the same judgement the ear just made.
//
// The rungs sit flush against each other whatever the round offers. Hanging each at its
// true distance instead left an easy round of three intervals as three rungs adrift in an
// octave of blank space, and the drill opens on exactly that round.

// The app's standard minimum tap target, so a rung is as pressable as any button.
const RUNG_HEIGHT = 44;

export function EarLadder({
    choices,
    answer,
    given,
    onChoose,
}: {
    choices: IntervalId[];
    // Set once the round is answered; until then the ladder is live and reveals nothing.
    answer: IntervalId | null;
    given: IntervalId | null;
    onChoose: (interval: IntervalId) => void;
}) {
    const settled = answer !== null;
    // Widest first: the top of the stack is the widest leap, as it is on a keyboard and on
    // a staff.
    const rungs = [...choices].sort((a, b) => semitonesOf(b) - semitonesOf(a));

    return (
        <fieldset
            className="relative mx-auto flex w-full min-w-0 max-w-md flex-col"
            aria-label={m.ear_ladder_label()}
        >
            {/* The measuring line the rungs hang off — the ladder's own upright. */}
            <div
                aria-hidden="true"
                className="absolute bottom-0 left-4 top-0 w-px bg-subtle-strong"
            />
            {rungs.map((interval) => {
                const verdict: Verdict = !settled
                    ? null
                    : interval === answer
                      ? "correct"
                      : interval === given
                        ? "wrong"
                        : null;
                // Once the round is settled every rung but the answer and the player's
                // pick recedes, so the comparison that teaches is the only thing lit.
                const dimmed = settled && verdict === null;
                return (
                    <button
                        type="button"
                        key={interval}
                        disabled={settled}
                        onClick={() => onChoose(interval)}
                        className={`flex items-center rounded-md border px-4 text-sm font-medium transition-colors disabled:cursor-default ${answerClasses(verdict, dimmed)}`}
                        style={{ height: `${RUNG_HEIGHT}px` }}
                    >
                        {interval === answer && settled ? (
                            <span className="mr-2 text-xs font-semibold uppercase tracking-wide">
                                {m.ear_answer_was()}
                            </span>
                        ) : null}
                        {intervalName(interval)}
                    </button>
                );
            })}
        </fieldset>
    );
}

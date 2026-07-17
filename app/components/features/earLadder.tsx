// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { IntervalId } from "../../../core/theory";
import { semitonesOf, SEMITONES_PER_OCTAVE } from "../../../core/theory";
import { intervalName } from "../../lib/theoryNames";
import { m } from "../../paraglide/messages.js";

// The answer surface for the interval exercise. An interval IS a distance, so the
// choices are rungs on a ladder at their true height — unison at the foot, the octave
// at the top, everything else spaced by the semitones it actually spans. Picking an
// answer is picking a height, which is the same judgement the ear just made.
//
// The rungs of an easy round sit far apart; a harder round fills the gaps in. That
// crowding is the difficulty, drawn rather than described.

// The app's standard minimum tap target, so a rung is as pressable as any button.
const RUNG_HEIGHT = 44;

// The span is sized so that ONE SEMITONE IS ONE RUNG. That is the invariant the whole
// component rests on: at the fullest level every interval is offered, the closest pair
// sits a semitone apart, and each still gets a whole tap target with no overlap. It
// also means the airiness of an easy round is real rather than decorative — three rungs
// across the same octave simply have further to sit apart.
const LADDER_HEIGHT = RUNG_HEIGHT * SEMITONES_PER_OCTAVE;

// Every rung is centred on the height it names, so the unison and the octave each hang
// half a rung past the span's ends. The fieldset is that much taller and the measured
// span sits inset within it, which keeps the outermost rungs inside the component
// instead of overflowing whatever contains it.
const INSET = RUNG_HEIGHT / 2;
const BOX_HEIGHT = LADDER_HEIGHT + RUNG_HEIGHT;

type Verdict = "correct" | "wrong" | null;

// Where a rung sits, as a percentage from the foot of the ladder. The rung is centred
// on its height, so the label lines up with the distance it names.
function offsetOf(interval: IntervalId): number {
    return (semitonesOf(interval) / SEMITONES_PER_OCTAVE) * 100;
}

function rungClasses(verdict: Verdict, dimmed: boolean): string {
    if (verdict === "correct") {
        return "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500";
    }
    if (verdict === "wrong") {
        return "border-red-700 bg-red-700 text-white dark:border-red-600 dark:bg-red-600";
    }
    if (dimmed) {
        return "border-gray-200 bg-white text-gray-400 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-600";
    }
    return "border-gray-300 bg-white text-gray-900 hover:border-indigo-600 hover:text-indigo-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:border-indigo-500 dark:hover:text-indigo-300";
}

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
    const rungs = [...choices].sort((a, b) => semitonesOf(a) - semitonesOf(b));

    return (
        <fieldset
            className="relative mx-auto w-full min-w-0 max-w-md"
            style={{ height: `${BOX_HEIGHT}px` }}
            aria-label={m.ear_ladder_label()}
        >
            {/* The measuring line the rungs hang off — the ladder's own upright. It spans
                the octave exactly, so its ends mark the unison and the octave. */}
            <div
                aria-hidden="true"
                className="absolute left-4 w-px bg-gray-200 dark:bg-gray-800"
                style={{ top: `${INSET}px`, bottom: `${INSET}px` }}
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
                        className={`absolute left-0 right-0 flex items-center rounded-md border px-4 text-sm font-medium transition-colors disabled:cursor-default ${rungClasses(verdict, dimmed)}`}
                        style={{
                            height: `${RUNG_HEIGHT}px`,
                            // Measured against the inset span, not the padded box, so a
                            // rung still lands on the exact height it names.
                            bottom: `${INSET + (offsetOf(interval) / 100) * LADDER_HEIGHT - RUNG_HEIGHT / 2}px`,
                        }}
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

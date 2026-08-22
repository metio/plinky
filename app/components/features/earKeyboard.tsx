// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { NOTE_LABELS } from "../../../core/keyMap";
import { noteNameOf, type NoteNameId, type PitchClass } from "../../../core/theory";
import { m } from "../../paraglide/messages.js";
import { optionVerdict } from "../../../core/earAnswer";
import { answerClasses, VERDICT_FILL, type Verdict } from "./earVerdict";

// The answer surface for the perfect-pitch exercise. The question is "which note was
// that?", and the answer set is the twelve notes — which is a keyboard. Naming C by
// pressing C needs no explaining, and it keeps the answer in the vocabulary the player
// already uses everywhere else in Plinky.
//
// One octave, no octave choice: the exercise asks for the note, not the register.
//
// The keys are labelled from core/keyMap's NOTE_LABELS — the same table the computer
// keyboard is labelled from — so a note is spelled identically wherever it appears.
// Letter names deliberately do NOT go through paraglide: they are not translated
// anywhere else in Plinky, and a keyboard reading "Do" here beside one reading "C" on
// the play page would be worse than either choice made consistently.

const WHITE: PitchClass[] = [0, 2, 4, 5, 7, 9, 11];
// Each black key hangs at the boundary between two white keys; the index is which
// boundary, counted in white keys from the left.
const BLACK: { pitchClass: PitchClass; boundary: number }[] = [
    { pitchClass: 1, boundary: 1 },
    { pitchClass: 3, boundary: 2 },
    { pitchClass: 6, boundary: 4 },
    { pitchClass: 8, boundary: 5 },
    { pitchClass: 10, boundary: 6 },
];

// A white key waiting to be pressed: the instrument's own colours rather than a card's.
const WHITE_IDLE =
    "border-line-strong bg-key-white text-key-ink hover:bg-key-hover hover:text-accent-strong";

const WHITE_WIDTH = 100 / WHITE.length;
const BLACK_WIDTH = WHITE_WIDTH * 0.62;

function whiteClasses(verdict: Verdict, settled: boolean): string {
    return answerClasses(verdict, settled, WHITE_IDLE);
}

// A black key carries no border of its own, so the verdict arrives as fill alone.
function blackClasses(verdict: Verdict, settled: boolean): string {
    if (verdict !== null) {
        return VERDICT_FILL[verdict];
    }
    return settled
        ? "bg-key-spent text-key-spent-ink"
        : "bg-key-black text-key-black-ink hover:bg-accent-solid-hover";
}

export function EarKeyboard({
    choices,
    answer,
    given,
    onChoose,
}: {
    choices: NoteNameId[];
    // Set once the round is answered; until then the keyboard reveals nothing.
    answer: NoteNameId | null;
    given: NoteNameId | null;
    onChoose: (note: NoteNameId) => void;
}) {
    const settled = answer !== null;
    const offered = (pitchClass: PitchClass) => choices.includes(noteNameOf(pitchClass));

    return (
        <fieldset
            className="relative mx-auto h-44 w-full min-w-0 max-w-md select-none"
            aria-label={m.ear_keyboard_label()}
        >
            <div className="flex h-full w-full gap-1">
                {WHITE.map((pitchClass) => {
                    const name = noteNameOf(pitchClass);
                    const verdict = optionVerdict(name, answer, given);
                    return (
                        <button
                            type="button"
                            key={pitchClass}
                            disabled={settled || !offered(pitchClass)}
                            onClick={() => onChoose(name)}
                            className={`flex flex-1 items-end justify-center rounded-b-md border pb-2 text-sm font-medium transition-colors disabled:cursor-default ${whiteClasses(verdict, settled)}`}
                        >
                            {NOTE_LABELS[pitchClass]}
                        </button>
                    );
                })}
            </div>
            {BLACK.filter(({ pitchClass }) => offered(pitchClass)).map(
                ({ pitchClass, boundary }) => {
                    const name = noteNameOf(pitchClass);
                    const verdict = optionVerdict(name, answer, given);
                    return (
                        <button
                            type="button"
                            key={pitchClass}
                            disabled={settled}
                            onClick={() => onChoose(name)}
                            className={`absolute top-0 flex h-[60%] items-end justify-center rounded-b-md pb-1.5 text-xs font-medium transition-colors disabled:cursor-default ${blackClasses(verdict, settled)}`}
                            style={{
                                width: `${BLACK_WIDTH}%`,
                                left: `calc(${boundary * WHITE_WIDTH}% - ${BLACK_WIDTH / 2}%)`,
                            }}
                        >
                            {NOTE_LABELS[pitchClass]}
                        </button>
                    );
                },
            )}
        </fieldset>
    );
}

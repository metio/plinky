// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useCallback, useMemo, useState } from "react";
import {
    awaited,
    beginTour,
    currentStep,
    isDone,
    nextStep,
    observe,
    stepReady,
    MIDDLE_C,
    TOUR_STEPS,
    TOUR_TO,
    type TourStep,
    tourProgress,
} from "../../../core/keyboardTour";
import { buildSnippet, NATURAL_OF, type SnippetNote } from "../../../core/glossaryScore";
import { holdScaleFor } from "../../../core/midi";
import { useMidiConnection, useMidiInput, useHeldNotes } from "../../contexts/midi";
import { useKeyboardTheme } from "../../hooks/useKeyboardTheme";
import { useNoteLabels } from "../../hooks/useNoteLabels";
import { useSynth } from "../../hooks/useSynth";
import { m } from "../../paraglide/messages.js";
import { Button } from "../ui/button";
import { Keyboard } from "../ui/keyboard";
import { NotationExample } from "./notationExample";

// The guided first hour: six facts about a piano, each ending in a press.
//
// Every input reaches it the same way — a tapped on-screen key, a computer key, a real
// MIDI piano — because the shared connection funnel is what the rest of the app plays
// through, so a beginner who later plugs in a keyboard finds it already works here.
//
// The step's own keys are lit, and the one it is waiting for is prompted. A press that
// is not the one asked for still sounds, still lights up, and simply does not advance:
// wandering along the keys is how a keyboard gets learned.

const STEP_TITLE: Record<string, () => string> = {
    blackGroups: m.tour_black_groups_title,
    middleC: m.tour_middle_c_title,
    whiteRun: m.tour_white_run_title,
    blackNames: m.tour_black_names_title,
    noteToKey: m.tour_note_to_key_title,
    highLow: m.tour_high_low_title,
};

const STEP_BODY: Record<string, () => string> = {
    blackGroups: m.tour_black_groups_body,
    middleC: m.tour_middle_c_body,
    whiteRun: m.tour_white_run_body,
    blackNames: m.tour_black_names_body,
    noteToKey: m.tour_note_to_key_body,
    highLow: m.tour_high_low_body,
};

// A step's staff pitches, drawn on the same engine as every real score so what is
// learned here looks like what will be met in a piece.
function staffXml(step: TourStep): string | null {
    if (!step.staff) {
        return null;
    }
    const notes: SnippetNote[] = [];
    for (const note of step.staff) {
        const letter = NATURAL_OF[((note % 12) + 12) % 12];
        if (letter) {
            notes.push({ step: letter, octave: Math.floor(note / 12) - 1, value: "half" });
        }
    }
    return notes.length > 0
        ? buildSnippet({ clef: "treble", fifths: 0, beatsPerBar: 4, notes })
        : null;
}

export function KeyboardTour({ onFinished }: { onFinished: () => void }) {
    const [state, setState] = useState(beginTour);
    const synth = useSynth();
    const labels = useNoteLabels();
    const theme = useKeyboardTheme();
    const { pressKey, releaseKey } = useMidiConnection();
    const heldNotes = useHeldNotes();

    const step = currentStep(state);
    const ready = stepReady(state);

    // Every note the funnel reports sounds and is offered to the tour, so a real piano
    // and the on-screen keys are the same thing as far as a step is concerned.
    const heard = useCallback((note: number) => setState((current) => observe(current, note)), []);

    useMidiInput({
        onNoteOn: (event) => {
            synth.pressNote(event.note, { velocity: event.velocity });
            heard(event.note);
        },
        onNoteOff: (event) => synth.releaseNote(event.note, holdScaleFor(event.device)),
    });

    const xml = useMemo(() => (step ? staffXml(step) : null), [step]);

    if (!step || isDone(state)) {
        return (
            <section className="space-y-4">
                <h2 className="text-xl font-semibold">{m.tour_done_title()}</h2>
                <p className="text-sm text-muted">{m.tour_done_body()}</p>
                <Button variant="primary" onClick={onFinished}>
                    {m.tour_done_action()}
                </Button>
            </section>
        );
    }

    const prompt = awaited(state);

    return (
        <section className="space-y-4">
            <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-accent">
                    {m.tour_step_of({ step: state.step + 1, total: TOUR_STEPS.length })}
                </p>
                <h2 className="text-xl font-semibold">{STEP_TITLE[step.id]?.() ?? ""}</h2>
                <p className="text-sm text-muted">{STEP_BODY[step.id]?.() ?? ""}</p>
            </div>

            <div
                className="h-1.5 w-full overflow-hidden rounded-full bg-subtle-strong"
                role="progressbar"
                aria-valuenow={Math.round(tourProgress(state) * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={m.tour_progress()}
            >
                <div
                    className="h-full bg-chart-peak"
                    style={{ width: `${tourProgress(state) * 100}%` }}
                />
            </div>

            {xml && (
                <NotationExample key={step.id} xml={xml} label={STEP_TITLE[step.id]?.() ?? ""} />
            )}

            <Keyboard
                from={MIDDLE_C}
                to={TOUR_TO}
                // Lit means a key is down. Only real presses light, or the tour would
                // look like a hand mashing five black keys at once.
                lit={new Set(heldNotes)}
                // What the step is asking for: the next key when it names one, and the
                // whole group when any of them will do (press any black key).
                expected={prompt.length > 0 ? prompt : step.highlight}
                labels={labels}
                theme={theme}
                well="mx-auto w-full max-w-lg"
                onPress={(note, velocity) => {
                    pressKey(note, velocity);
                    heard(note);
                }}
                onRelease={releaseKey}
            />

            <div className="flex items-center gap-3">
                <Button variant="primary" onClick={() => setState(nextStep)} disabled={!ready}>
                    {m.tour_next()}
                </Button>
                {ready ? (
                    <p className="text-sm text-success">{m.tour_got_it()}</p>
                ) : (
                    <p className="text-sm text-muted">{m.tour_waiting()}</p>
                )}
            </div>
        </section>
    );
}

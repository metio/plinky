// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useXmlCodec } from "../contexts/services";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMidiConnection, useMidiInput } from "../contexts/midi";
import { useSynth } from "../hooks/useSynth";
import { type MidiNoteEvent, noteName } from "../../core/midi";
import { scoreToBars, windowPositions } from "../../core/scoreToBars";
import { m } from "../paraglide/messages.js";
import { Button } from "./button";
import { Show } from "./conditional";
import { KeyboardHint } from "./keyboardHint";
import { PianoKeyboard } from "./pianoKeyboard";

const WINDOW = 2;
const STEP_MS = 600;

// Play the open piece's melody by ear: hear a two-bar phrase of the right-hand line,
// then reproduce it note by note on the keyboard. Reuses the bar window from the
// fingering mode (the treble staff's top notes) and matches by pitch class, so the
// ear — not the register — is what's trained.
export function EarPiece({ xml }: { xml: string }) {
    const xmlCodec = useXmlCodec();
    const synth = useSynth();
    const [start, setStart] = useState(0);

    const bars = useMemo(() => scoreToBars(xmlCodec, xml, 1), [xmlCodec, xml]);
    const lastStart = Math.max(0, bars.length - WINDOW);
    const clamped = Math.min(start, lastStart);
    // The melody: the top note of each position in the window, in play order.
    const phrase = useMemo(
        () => windowPositions(bars, clamped, WINDOW).map((pos) => Math.max(...pos)),
        [bars, clamped],
    );

    const [index, setIndex] = useState(0);
    const [correct, setCorrect] = useState(0);
    const [attempts, setAttempts] = useState(0);
    const [wrong, setWrong] = useState<number | null>(null);
    // The note just uncovered by Reveal, shown until the next note is acted on.
    const [revealed, setRevealed] = useState<number | null>(null);

    const phraseRef = useRef(phrase);
    phraseRef.current = phrase;
    // The phrase position, advanced synchronously inside handleNoteOn so two note-ons
    // arriving in one batch read distinct positions rather than both seeing the index
    // from the last render (which would mark the second, correct note wrong).
    const posRef = useRef(0);
    const timers = useRef<number[]>([]);

    const stop = useCallback(() => {
        for (const t of timers.current) {
            window.clearTimeout(t);
        }
        timers.current = [];
    }, []);

    // A new window (or piece) is a fresh phrase from the top; the cleanup also cancels
    // pending playback so it can't sound after the phrase or the mode is gone.
    // biome-ignore lint/correctness/useExhaustiveDependencies: phrase is the reset trigger
    useEffect(() => {
        posRef.current = 0;
        setIndex(0);
        setCorrect(0);
        setAttempts(0);
        setWrong(null);
        setRevealed(null);
        return stop;
    }, [phrase, stop]);

    const hearPhrase = useCallback(() => {
        stop();
        phrase.forEach((note, i) => {
            timers.current.push(
                window.setTimeout(() => synth.playNote(note, { duration: 0.6 }), i * STEP_MS),
            );
        });
    }, [phrase, synth, stop]);

    // Move to the next note, clearing the previous note's feedback.
    const advance = useCallback(() => {
        posRef.current += 1;
        setIndex(posRef.current);
        setWrong(null);
    }, []);

    const handleNoteOn = useCallback(
        (played: MidiNoteEvent) => {
            const expected = phraseRef.current[posRef.current];
            if (expected === undefined) {
                return;
            }
            setRevealed(null);
            setAttempts((value) => value + 1);
            if (played.note % 12 === expected % 12) {
                synth.playNote(expected);
                setCorrect((value) => value + 1);
                advance();
            } else {
                setWrong(played.note);
                synth.playNote(played.note, { duration: 0.4 });
            }
        },
        [synth, advance],
    );
    useMidiInput({ onNoteOn: handleNoteOn });

    // Give up on a note: hear and name the answer, count it as a (missed) attempt, and
    // move on, so a stuck learner isn't trapped on one note.
    const reveal = useCallback(() => {
        const expected = phraseRef.current[posRef.current];
        if (expected === undefined) {
            return;
        }
        synth.playNote(expected);
        setRevealed(expected);
        setAttempts((value) => value + 1);
        advance();
    }, [synth, advance]);

    // Move past a note without hearing it and without counting an attempt.
    const skip = useCallback(() => {
        setRevealed(null);
        advance();
    }, [advance]);

    const { octaveOffset } = useMidiConnection();
    const done = phrase.length > 0 && index >= phrase.length;
    // Changing the window changes the phrase, which the effect above resets to.
    const move = (delta: number) => {
        setStart(Math.max(0, Math.min(lastStart, clamped + delta)));
    };

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <Button variant="primary" onClick={hearPhrase} disabled={phrase.length === 0}>
                    {m.ear_piece_hear()}
                </Button>
                <Button variant="secondary" onClick={reveal} disabled={phrase.length === 0 || done}>
                    {m.ear_reveal()}
                </Button>
                <Button variant="ghost" onClick={skip} disabled={phrase.length === 0 || done}>
                    {m.ear_skip()}
                </Button>
                <span className="ml-auto flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => move(-1)}
                        disabled={clamped <= 0}
                        aria-label={m.fingering_prev_bars()}
                        className="rounded-md bg-indigo-50 px-2 py-1.5 text-sm font-medium text-indigo-700 disabled:opacity-40 dark:bg-indigo-950 dark:text-indigo-300"
                    >
                        ‹
                    </button>
                    <span className="text-sm tabular-nums text-gray-600 dark:text-gray-400">
                        {m.fingering_bars({
                            from: clamped + 1,
                            to: Math.min(clamped + WINDOW, bars.length),
                            total: bars.length,
                        })}
                    </span>
                    <button
                        type="button"
                        onClick={() => move(1)}
                        disabled={clamped >= lastStart}
                        aria-label={m.fingering_next_bars()}
                        className="rounded-md bg-indigo-50 px-2 py-1.5 text-sm font-medium text-indigo-700 disabled:opacity-40 dark:bg-indigo-950 dark:text-indigo-300"
                    >
                        ›
                    </button>
                </span>
            </div>

            {phrase.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">{m.ear_piece_empty()}</p>
            ) : done ? (
                <p className="text-sm font-semibold text-green-600">{m.ear_piece_done()}</p>
            ) : (
                <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                    {m.ear_piece_progress({ index: index + 1, total: phrase.length })}
                    {wrong !== null && (
                        <span className="ml-2 text-red-600 dark:text-red-400">
                            {m.ear_not_note({ note: noteName(wrong) })}
                        </span>
                    )}
                    {revealed !== null && (
                        <span className="ml-2 text-indigo-600 dark:text-indigo-300">
                            {m.ear_revealed({ note: noteName(revealed) })}
                        </span>
                    )}
                </p>
            )}
            <Show when={attempts > 0}>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-mono">{correct}</span>/
                    <span className="font-mono">{attempts}</span> {m.sprint_correct_label()}
                </p>
            </Show>

            <PianoKeyboard expected={[]} />
            <KeyboardHint octaveOffset={octaveOffset} />
        </section>
    );
}

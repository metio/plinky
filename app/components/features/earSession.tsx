// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EAR_SESSION_ROUNDS, earItemFor } from "../../../core/earCatalog";
import {
    type EarExerciseId,
    type EarQuestion,
    type EarRound,
    generateQuestion,
    isCorrect,
    scoreRounds,
} from "../../../core/earExercise";
import { applyRun, letterMin } from "../../../core/mastery";
import type { ChordQuality, IntervalId, NoteNameId, ScaleId } from "../../../core/theory";
import { useMasteryStore, usePrefsStore } from "../../contexts/services";
import { chordName, scaleName } from "../../lib/theoryNames";
import { m } from "../../paraglide/messages.js";
import { Button } from "../ui/button";
import { EarChoices } from "./earChoices";
import { EarKeyboard } from "./earKeyboard";
import { EarLadder } from "./earLadder";
import { EarStage } from "./earStage";

// The one-line prompt on the resting start card, per exercise.
const BLURB: Record<EarExerciseId, () => string> = {
    intervals: m.ear_intervals_blurb,
    "perfect-pitch": m.ear_pitch_blurb,
    chords: m.ear_chords_blurb,
    scales: m.ear_scales_blurb,
};

// A bounded run of one ear exercise: it plays a question, takes an answer, and after
// EAR_SESSION_ROUNDS folds the run's accuracy into the item's mastery — the same score a
// played run folds into a piece's, so ear practice raises the same standing and skill.
//
// It is self-contained on (exercise, level): remounting with a new key starts a fresh
// run, which is how both the /ear page (the selectors change the key) and the review
// session (each queue item is its own key) reset it without an imperative handle. The
// caller supplies the pair; where they come from — a player's choice or a due item — is
// the caller's business.
export function EarSession({
    exercise,
    level,
    autoStart = false,
    onComplete,
}: {
    exercise: EarExerciseId;
    level: number;
    // Start on the first question instead of a resting start card — the review flow, which
    // has already committed to this drill, skips the extra tap.
    autoStart?: boolean;
    // Fires once when a run finishes and its mastery is recorded, with the item's id — the
    // review flow counts the drill as refreshed and moves on. Its presence also swaps the
    // finished-state control from "practise again" to nothing, so the caller drives what
    // comes next.
    onComplete?: (itemId: string) => void;
}) {
    const mastery = useMasteryStore();
    const prefs = usePrefsStore();
    const [question, setQuestion] = useState<EarQuestion | null>(null);
    const [given, setGiven] = useState<string | null>(null);
    const [rounds, setRounds] = useState<EarRound[]>([]);
    // A completed run records once. The guard survives the re-render (and StrictMode's
    // double-invoked effect) where a piece of state would let it fire twice and
    // double-advance the review schedule.
    const recorded = useRef(false);

    const score = useMemo(() => scoreRounds(rounds), [rounds]);
    const done = rounds.length >= EAR_SESSION_ROUNDS;

    const next = useCallback(() => {
        setGiven(null);
        setQuestion(generateQuestion(exercise, level, Math.random));
    }, [exercise, level]);

    // A review drill has already been chosen, so it opens straight on its first question.
    // Both deps are stable for a mount — autoStart is a prop, next is fixed by the keyed
    // (exercise, level) — so this fires once and the remount on a changed key resets it.
    useEffect(() => {
        if (autoStart) {
            next();
        }
    }, [autoStart, next]);

    const answer = useCallback(
        (choice: string) => {
            if (question === null || given !== null || done) {
                return;
            }
            setGiven(choice);
            setRounds((current) => [
                ...current,
                { answer: question.answer, given: choice, correct: isCorrect(question, choice) },
            ]);
        },
        [done, given, question],
    );

    const practiseAgain = useCallback(() => {
        recorded.current = false;
        setGiven(null);
        setRounds([]);
        next();
    }, [next]);

    // A finished run lands on the grade ladder: applyRun folds the accuracy into the ear
    // item's mastery exactly as a played run folds into a piece's. Only the mastery step
    // of a run applies — there are no notes to time, ghost or grid.
    useEffect(() => {
        if (!done || recorded.current) {
            return;
        }
        recorded.current = true;
        const item = earItemFor(exercise, level);
        if (!item) {
            return;
        }
        const runScore = Math.round(scoreRounds(rounds).accuracy * 100);
        const threshold = letterMin(prefs.load().masteryThreshold);
        mastery.save(item.id, applyRun(mastery.load(item.id), runScore, threshold, Date.now()));
        onComplete?.(item.id);
    }, [done, exercise, level, rounds, mastery, prefs, onComplete]);

    const settled = given !== null;
    const wasCorrect = question !== null && settled && isCorrect(question, given);

    if (question === null) {
        return (
            <div className="space-y-4 rounded-xl border border-gray-200 p-8 text-center dark:border-gray-800">
                <p className="text-sm text-gray-600 dark:text-gray-400">{BLURB[exercise]()}</p>
                <Button variant="primary" onClick={next}>
                    {m.ear_start()}
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <EarStage notes={question.notes} autoPlay={true} />

            {question.kind === "intervals" ? (
                <EarLadder
                    choices={question.choices}
                    answer={settled ? question.answer : null}
                    given={settled ? (given as IntervalId) : null}
                    onChoose={answer}
                />
            ) : question.kind === "perfect-pitch" ? (
                <EarKeyboard
                    choices={question.choices}
                    answer={settled ? question.answer : null}
                    given={settled ? (given as NoteNameId) : null}
                    onChoose={answer}
                />
            ) : question.kind === "chords" ? (
                <EarChoices
                    choices={question.choices}
                    answer={settled ? question.answer : null}
                    given={settled ? (given as ChordQuality) : null}
                    onChoose={answer}
                    nameOf={chordName}
                    label={m.ear_chord_choices()}
                />
            ) : (
                <EarChoices
                    choices={question.choices}
                    answer={settled ? question.answer : null}
                    given={settled ? (given as ScaleId) : null}
                    onChoose={answer}
                    nameOf={scaleName}
                    label={m.ear_scale_choices()}
                />
            )}

            <div className="flex items-center justify-between gap-4">
                <p
                    aria-live="polite"
                    className="text-sm font-medium text-gray-900 dark:text-gray-100"
                >
                    {done
                        ? m.ear_session_recorded()
                        : settled
                          ? wasCorrect
                              ? m.ear_verdict_right()
                              : m.ear_verdict_close()
                          : m.ear_prompt()}
                </p>
                {done ? (
                    // In a review the caller owns what comes next; standalone, offer another run.
                    onComplete ? null : (
                        <Button variant="primary" onClick={practiseAgain}>
                            {m.ear_again()}
                        </Button>
                    )
                ) : settled ? (
                    <Button variant="primary" onClick={next}>
                        {m.ear_next()}
                    </Button>
                ) : null}
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
                <span>{m.ear_score({ correct: score.correct, asked: score.asked })}</span>
                {" · "}
                <span>
                    {rounds.length} / {EAR_SESSION_ROUNDS}
                </span>
            </p>
        </div>
    );
}

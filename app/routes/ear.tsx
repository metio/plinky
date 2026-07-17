// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EAR_SESSION_ROUNDS, earItemFor } from "../../core/earCatalog";
import {
    type EarExerciseId,
    type EarQuestion,
    type EarRound,
    DEFAULT_HIGHEST,
    DEFAULT_LOWEST,
    generateInterval,
    generatePerfectPitch,
    INTERVAL_LEVELS,
    isCorrect,
    scoreRounds,
} from "../../core/earExercise";
import { applyRun, letterMin } from "../../core/mastery";
import type { IntervalId, NoteNameId } from "../../core/theory";
import { routeMeta } from "../../core/site";
import { useMasteryStore, usePrefsStore } from "../contexts/services";
import { EarKeyboard } from "../components/features/earKeyboard";
import { EarLadder } from "../components/features/earLadder";
import { EarStage } from "../components/features/earStage";
import { Button } from "../components/ui/button";
import { ChoiceField } from "../components/ui/fields";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/ear";

export function meta(_args: Route.MetaArgs) {
    return routeMeta(m.meta_ear_title(), m.meta_ear_description());
}

const EXERCISES: { id: EarExerciseId; label: () => string }[] = [
    { id: "intervals", label: m.ear_exercise_intervals },
    { id: "perfect-pitch", label: m.ear_exercise_perfect_pitch },
];

// Named by what they add rather than numbered: "Thirds & fourths" says what the round
// holds, where "Level 2" only says it comes after level 1.
const LEVELS: { id: string; label: () => string }[] = [
    { id: "0", label: m.ear_level_fifths },
    { id: "1", label: m.ear_level_thirds },
    { id: "2", label: m.ear_level_seconds },
    { id: "3", label: m.ear_level_all },
];

export default function Ear() {
    const mastery = useMasteryStore();
    const prefs = usePrefsStore();
    const [exercise, setExercise] = useState<EarExerciseId>("intervals");
    const [level, setLevel] = useState("0");
    const [question, setQuestion] = useState<EarQuestion | null>(null);
    const [given, setGiven] = useState<string | null>(null);
    const [rounds, setRounds] = useState<EarRound[]>([]);
    // A completed session records once. The guard survives a re-render (and StrictMode's
    // double-invoked effect) where a piece of state would let the record fire twice and
    // double-advance the review schedule.
    const recorded = useRef(false);

    const score = useMemo(() => scoreRounds(rounds), [rounds]);
    const done = rounds.length >= EAR_SESSION_ROUNDS;

    const next = useCallback(() => {
        setGiven(null);
        setQuestion(
            exercise === "intervals"
                ? generateInterval(
                      {
                          intervals: INTERVAL_LEVELS[Number(level)] ?? INTERVAL_LEVELS[0]!,
                          direction: "ascending",
                          lowest: DEFAULT_LOWEST,
                          highest: DEFAULT_HIGHEST,
                      },
                      Math.random,
                  )
                : generatePerfectPitch(
                      { naturalsOnly: true, lowest: DEFAULT_LOWEST, highest: DEFAULT_HIGHEST },
                      Math.random,
                  ),
        );
    }, [exercise, level]);

    // Clears the session so the next question starts a fresh run — and re-arms the record
    // guard, so the new session's finish records in its turn.
    const reset = useCallback((change?: () => void) => {
        change?.();
        recorded.current = false;
        setQuestion(null);
        setGiven(null);
        setRounds([]);
    }, []);

    // Changing the exercise or the level starts a fresh session: the score answered a
    // different question, so carrying it over would say something untrue.
    const restart = useCallback((change: () => void) => reset(change), [reset]);

    // Clears the finished session and rolls straight into the first round of the next
    // one, so "practise again" is one tap rather than a return to the start card.
    const practiseAgain = useCallback(() => {
        reset();
        next();
    }, [reset, next]);

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

    // A finished session lands on the grade ladder: the run's accuracy becomes a score,
    // and applyRun folds it into the ear item's mastery exactly as a played run folds
    // into a piece's — so ear practice raises the same standing and skill. Only the
    // mastery step of a run applies here; there are no notes to time, ghost or grid.
    useEffect(() => {
        if (!done || recorded.current) {
            return;
        }
        recorded.current = true;
        const item = earItemFor(exercise, Number(level));
        if (!item) {
            return;
        }
        const runScore = Math.round(scoreRounds(rounds).accuracy * 100);
        const threshold = letterMin(prefs.load().masteryThreshold);
        mastery.save(item.id, applyRun(mastery.load(item.id), runScore, threshold, Date.now()));
    }, [done, exercise, level, rounds, mastery, prefs]);

    const settled = given !== null;
    const wasCorrect = question !== null && settled && isCorrect(question, given);

    return (
        <main className="mx-auto max-w-3xl space-y-5 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">{m.ear_title()}</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">{m.ear_intro()}</p>
            </header>

            <ChoiceField
                label={m.ear_exercise_label()}
                value={exercise}
                onChange={(next) => restart(() => setExercise(next as EarExerciseId))}
                options={EXERCISES.map((item) => ({ id: item.id, label: item.label() }))}
            />

            {exercise === "intervals" ? (
                <ChoiceField
                    label={m.ear_level_label()}
                    value={level}
                    onChange={(next) => restart(() => setLevel(next))}
                    options={LEVELS.map((item) => ({ id: item.id, label: item.label() }))}
                    help={m.ear_level_help()}
                />
            ) : null}

            {question === null ? (
                <div className="space-y-4 rounded-xl border border-gray-200 p-8 text-center dark:border-gray-800">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        {exercise === "intervals" ? m.ear_intervals_blurb() : m.ear_pitch_blurb()}
                    </p>
                    <Button variant="primary" onClick={next}>
                        {m.ear_start()}
                    </Button>
                </div>
            ) : (
                <div className="space-y-6">
                    <EarStage notes={question.notes} autoPlay={true} />

                    {question.kind === "intervals" ? (
                        <EarLadder
                            choices={question.choices}
                            answer={settled ? question.answer : null}
                            given={settled ? (given as IntervalId) : null}
                            onChoose={answer}
                        />
                    ) : (
                        <EarKeyboard
                            choices={question.choices}
                            answer={settled ? question.answer : null}
                            given={settled ? (given as NoteNameId) : null}
                            onChoose={answer}
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
                            <Button variant="primary" onClick={practiseAgain}>
                                {m.ear_again()}
                            </Button>
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
            )}
        </main>
    );
}

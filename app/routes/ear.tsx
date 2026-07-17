// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useCallback, useMemo, useState } from "react";
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
import type { IntervalId, NoteNameId } from "../../core/theory";
import { routeMeta } from "../../core/site";
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
    const [exercise, setExercise] = useState<EarExerciseId>("intervals");
    const [level, setLevel] = useState("0");
    const [question, setQuestion] = useState<EarQuestion | null>(null);
    const [given, setGiven] = useState<string | null>(null);
    const [rounds, setRounds] = useState<EarRound[]>([]);

    const score = useMemo(() => scoreRounds(rounds), [rounds]);

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

    // Changing the exercise or the level starts a fresh session: the score answered a
    // different question, so carrying it over would say something untrue.
    const restart = useCallback((change: () => void) => {
        change();
        setQuestion(null);
        setGiven(null);
        setRounds([]);
    }, []);

    const answer = useCallback(
        (choice: string) => {
            if (question === null || given !== null) {
                return;
            }
            setGiven(choice);
            setRounds((current) => [
                ...current,
                { answer: question.answer, given: choice, correct: isCorrect(question, choice) },
            ]);
        },
        [given, question],
    );

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
                            {settled
                                ? wasCorrect
                                    ? m.ear_verdict_right()
                                    : m.ear_verdict_close()
                                : m.ear_prompt()}
                        </p>
                        {settled ? (
                            <Button variant="primary" onClick={next}>
                                {m.ear_next()}
                            </Button>
                        ) : null}
                    </div>

                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {m.ear_score({ correct: score.correct, asked: score.asked })}
                    </p>
                </div>
            )}
        </main>
    );
}

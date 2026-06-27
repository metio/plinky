// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import {
    currentGrade,
    dueReviews,
    type GradedMastery,
    gradeFreshness,
    loadGradedMastery,
    masteredInGrade,
    skillRating,
    type StarTier,
    starTier,
} from "../lib/gradeProgress";
import { MAX_GRADE } from "../lib/scoreDifficulty";
import { m } from "../paraglide/messages.js";
import { LocalizedLink as Link } from "./localizedLink";

type EarnedTier = Exclude<StarTier, "none">;
const STAR: Record<EarnedTier, string> = { bronze: "🥉", silver: "🥈", gold: "🥇" };
const STAR_LABEL: Record<EarnedTier, () => string> = {
    bronze: m.grades_star_bronze,
    silver: m.grades_star_silver,
    gold: m.grades_star_gold,
};

// The grades roadmap: each of the eight difficulty grades as a pool you master into,
// the star you've earned in it, how fresh it is, and a capped list of pieces to
// refresh. Reads the player's graded mastery after mount. The decay mode is gentle
// until the Settings toggle lands.
export function GradeLadderView() {
    const [items, setItems] = useState<GradedMastery[] | null>(null);

    useEffect(() => {
        let cancelled = false;
        loadGradedMastery().then((loaded) => {
            if (!cancelled) {
                setItems(loaded);
            }
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const now = Date.now();
    const resolved = items ?? [];
    const level = currentGrade(resolved, "gentle", now);
    const skill = skillRating(resolved, "gentle", now);
    const reviews = dueReviews(resolved, now);
    const byId = new Map(resolved.map((item) => [item.id, item]));
    const grades = Array.from({ length: MAX_GRADE }, (_, i) => i + 1);

    return (
        <main className="mx-auto max-w-3xl space-y-5 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">{m.grades_heading()}</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">{m.grades_intro()}</p>
            </header>

            <div className="flex items-center justify-between gap-3 rounded-md border border-gray-200 p-4 dark:border-gray-800">
                <span className="flex items-center gap-3">
                    <span aria-hidden="true" className="text-4xl">
                        🎓
                    </span>
                    <span className="text-2xl font-bold">
                        {level === 0 ? m.grades_not_started() : m.grades_current({ level })}
                    </span>
                </span>
                <span className="text-right text-sm text-gray-600 dark:text-gray-400">
                    {m.grades_skill({ rating: skill })}
                </span>
            </div>

            <ul className="space-y-2">
                {grades.map((grade) => {
                    const mastered = masteredInGrade(resolved, grade, "gentle", now);
                    const tier = starTier(mastered);
                    const { due } = gradeFreshness(resolved, grade, "gentle", now);
                    const isCurrent = grade === level;
                    return (
                        <li
                            key={grade}
                            className={`flex items-center justify-between gap-3 rounded-md border p-3 ${
                                isCurrent
                                    ? "border-indigo-300 bg-indigo-50/60 dark:border-indigo-800 dark:bg-indigo-950/40"
                                    : "border-gray-200 dark:border-gray-800"
                            }`}
                        >
                            <span className="flex items-center gap-2">
                                <span className="font-semibold">{m.grades_grade({ grade })}</span>
                                {tier !== "none" && (
                                    <span role="img" aria-label={STAR_LABEL[tier]()}>
                                        {STAR[tier]}
                                    </span>
                                )}
                            </span>
                            <span className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                                <span className="tabular-nums">
                                    {m.grades_mastered({ count: mastered })}
                                </span>
                                <span
                                    className={
                                        due > 0
                                            ? "text-amber-700 dark:text-amber-400"
                                            : "text-green-700 dark:text-green-400"
                                    }
                                >
                                    {due > 0 ? m.grades_due({ count: due }) : m.grades_fresh()}
                                </span>
                            </span>
                        </li>
                    );
                })}
            </ul>

            <section className="space-y-2">
                <h2 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {m.grades_refresh_heading()}
                </h2>
                {reviews.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {m.grades_all_fresh()}
                    </p>
                ) : (
                    <ul className="space-y-1 text-sm">
                        {reviews.map((id) => (
                            <li key={id}>
                                <Link
                                    to={`/play/${id}`}
                                    className="text-indigo-700 underline dark:text-indigo-300"
                                >
                                    {byId.get(id)?.title ?? id}
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <Link to="/" className="text-sm text-indigo-700 underline dark:text-indigo-300">
                {m.action_back_home()}
            </Link>
        </main>
    );
}

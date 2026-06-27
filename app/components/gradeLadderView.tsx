// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import {
    currentGrade,
    dueReviews,
    type GradeCatalogItem,
    type GradedMastery,
    gradeFreshness,
    gradeSuggestions,
    loadGradeCatalogue,
    loadGradedMastery,
    masteredInGrade,
    nextStar,
    poolSizes,
    skillRating,
    type StarTier,
    starTier,
} from "../lib/gradeProgress";
import { allFirstStepsDone, type FirstSteps, firstSteps } from "../lib/onboarding";
import { loadPrefs } from "../lib/prefs";
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

// The Grade-0 first-steps checklist: get a brand-new player moving toward Grade 1.
const FIRST_STEPS: { key: keyof FirstSteps; label: () => string; to: string }[] = [
    { key: "played", label: m.grades_start_play, to: "/library" },
    { key: "handSet", label: m.grades_start_hand, to: "/settings" },
    { key: "dailyDone", label: m.grades_start_daily, to: "/daily" },
];

const SUGGESTION_COUNT = 4;
const LINK = "text-indigo-700 underline dark:text-indigo-300";

// The grades roadmap: each of the eight difficulty grades as a pool you master into,
// the star you've earned, how close the next star is, and how fresh it is — plus the
// gentlest pieces to play next in the grade you're working on, and a capped refresh
// queue. Reads mastery and the catalogue after mount. Decay is gentle until the
// Settings toggle lands.
export function GradeLadderView() {
    const [items, setItems] = useState<GradedMastery[] | null>(null);
    const [catalogue, setCatalogue] = useState<GradeCatalogItem[]>([]);

    useEffect(() => {
        let cancelled = false;
        loadGradedMastery().then((loaded) => !cancelled && setItems(loaded));
        loadGradeCatalogue().then((loaded) => !cancelled && setCatalogue(loaded));
        return () => {
            cancelled = true;
        };
    }, []);

    const now = Date.now();
    const mode = loadPrefs().decayMode;
    const resolved = items ?? [];
    const level = currentGrade(resolved, mode, now);
    // Read the first-steps state only on the client (after mount), so it doesn't run
    // against absent localStorage during prerender.
    const mounted = items !== null;
    const steps = mounted ? firstSteps() : null;
    const showOnboarding = level === 0 && steps !== null && !allFirstStepsDone(steps);
    const skill = skillRating(resolved, mode, now);
    const reviews = dueReviews(resolved, now);
    const byId = new Map(resolved.map((item) => [item.id, item]));
    const masteredIds = new Set(
        resolved.filter((item) => item.mastery.learned && !item.mastery.backlog).map((i) => i.id),
    );
    const sizes = poolSizes(catalogue);
    const grades = Array.from({ length: MAX_GRADE }, (_, i) => i + 1);

    // The grade you're working on: the one above your current standing, or your first.
    const workingGrade = Math.min(level + 1, MAX_GRADE);
    const upNext = gradeSuggestions(catalogue, workingGrade, masteredIds, SUGGESTION_COUNT);

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
                <span className="flex flex-col items-end gap-0.5 text-right text-sm text-gray-600 dark:text-gray-400">
                    <span>{m.grades_skill({ rating: skill })}</span>
                    {mode === "competitive" && (
                        <span className="font-medium text-amber-700 dark:text-amber-400">
                            ⚔️ {m.grades_competitive()}
                        </span>
                    )}
                </span>
            </div>

            {showOnboarding && steps && (
                <section className="space-y-3 rounded-md border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
                    <h2 className="font-semibold text-indigo-800 dark:text-indigo-200">
                        {m.grades_start_heading()}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        {m.grades_start_intro()}
                    </p>
                    <ul className="space-y-1.5 text-sm">
                        {FIRST_STEPS.map((step) => {
                            const stepDone = steps[step.key];
                            return (
                                <li key={step.key} className="flex items-center gap-2">
                                    <span
                                        aria-hidden="true"
                                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                            stepDone
                                                ? "bg-green-600 text-white"
                                                : "border border-gray-300 text-transparent dark:border-gray-600"
                                        }`}
                                    >
                                        ✓
                                    </span>
                                    <Link
                                        to={step.to}
                                        className={
                                            stepDone
                                                ? "text-gray-500 line-through dark:text-gray-400"
                                                : LINK
                                        }
                                    >
                                        {step.label()}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            )}

            {upNext.length > 0 && (
                <section className="space-y-2 rounded-md border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
                    <h2 className="text-sm font-medium text-indigo-800 dark:text-indigo-200">
                        {m.grades_up_next({ grade: workingGrade })}
                    </h2>
                    <ul className="space-y-1 text-sm">
                        {upNext.map((item) => (
                            <li key={item.id}>
                                <Link to={`/play/${item.id}`} className={LINK}>
                                    {item.title}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <ul className="space-y-2">
                {grades.map((grade) => {
                    const mastered = masteredInGrade(resolved, grade, mode, now);
                    const tier = starTier(mastered);
                    const next = nextStar(mastered);
                    const { due } = gradeFreshness(resolved, grade, mode, now);
                    const total = sizes.get(grade) ?? 0;
                    return (
                        <li
                            key={grade}
                            className={`flex items-center justify-between gap-3 rounded-md border p-3 ${
                                grade === level
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
                                    {m.grades_pool({ mastered, total })}
                                </span>
                                <span className="text-gray-500 dark:text-gray-400">
                                    {next
                                        ? m.grades_to_next({
                                              count: next.remaining,
                                              tier: STAR_LABEL[next.tier](),
                                          })
                                        : m.grades_maxed()}
                                </span>
                                {due > 0 && (
                                    <span className="text-amber-700 dark:text-amber-400">
                                        {m.grades_due({ count: due })}
                                    </span>
                                )}
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
                                <Link to={`/play/${id}`} className={LINK}>
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

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
import { loadHistory, type PracticeSummary, summarizePractice } from "../lib/history";
import { loadLifetime, progressGrid } from "../lib/lifetime";
import { svgMilestone } from "../lib/milestoneCard";
import { allFirstStepsDone, type FirstSteps, firstSteps } from "../lib/onboarding";
import { loadPrefs } from "../lib/prefs";
import { MAX_GRADE } from "../lib/scoreDifficulty";
import type { Grid } from "../lib/shareCard";
import { m } from "../paraglide/messages.js";
import { LocalizedLink as Link } from "./localizedLink";
import { ShareButtons } from "./shareButtons";
import { ShareCard } from "./shareCard";

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

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-md border border-gray-200 p-4 dark:border-gray-800">
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {label}
            </div>
            <div className="font-mono text-3xl tabular-nums">{value}</div>
        </div>
    );
}

// The "You" page: how good you are at playing, in one place. Standing (grade + skill)
// and activity (streak, days, notes) up top; what to play next and the grade roadmap;
// the single refresh queue; then the retrospective — a 7-day chart and the lifetime
// Accuracy/Timing/Flow fingerprint. Reads mastery, the catalogue and practice history
// after mount, so the personal data is absent from the prerendered shell.
export function YouView() {
    const [items, setItems] = useState<GradedMastery[] | null>(null);
    const [catalogue, setCatalogue] = useState<GradeCatalogItem[]>([]);
    const [summary, setSummary] = useState<PracticeSummary | null>(null);
    const [fingerprint, setFingerprint] = useState<Grid | null>(null);

    useEffect(() => {
        let cancelled = false;
        setSummary(summarizePractice(loadHistory()));
        setFingerprint(progressGrid(loadLifetime()));
        loadGradedMastery().then((loaded) => !cancelled && setItems(loaded));
        loadGradeCatalogue().then((loaded) => !cancelled && setCatalogue(loaded));
        return () => {
            cancelled = true;
        };
    }, []);

    // Wait for the personal data before painting anything, so the page renders once
    // fully rather than prerendering a roadmap that shifts as the data lands — the
    // whole page is client-only mastery/history, and a single paint keeps CLS at zero.
    if (items === null) {
        return null;
    }

    const now = Date.now();
    const mode = loadPrefs().decayMode;
    const resolved = items;
    const level = currentGrade(resolved, mode, now);
    const steps = firstSteps();
    const showOnboarding = level === 0 && !allFirstStepsDone(steps);
    const skill = skillRating(resolved, mode, now);
    const reviews = dueReviews(resolved, now);
    const byId = new Map(resolved.map((item) => [item.id, item]));
    const masteredIds = new Set(
        resolved.filter((item) => item.mastery.learned && !item.mastery.backlog).map((i) => i.id),
    );
    const sizes = poolSizes(catalogue);
    const grades = Array.from({ length: MAX_GRADE }, (_, i) => i + 1);
    const workingGrade = Math.min(level + 1, MAX_GRADE);
    const upNext = gradeSuggestions(catalogue, workingGrade, masteredIds, SUGGESTION_COUNT);
    const max = summary ? Math.max(1, ...summary.recent.map((day) => day.notes)) : 1;

    return (
        <main className="mx-auto max-w-3xl space-y-5 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">{m.you_heading()}</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">{m.you_intro()}</p>
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

            {summary && (
                <div className="grid grid-cols-3 gap-4">
                    <Stat label={m.progress_day_streak()} value={`${summary.currentStreak} 🔥`} />
                    <Stat
                        label={m.progress_days_practiced()}
                        value={String(summary.daysPracticed)}
                    />
                    <Stat label={m.progress_notes_played()} value={String(summary.totalNotes)} />
                </div>
            )}

            {level >= 1 && (
                <section className="space-y-2">
                    <h2 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        {m.grades_share_heading()}
                    </h2>
                    <ShareButtons
                        text={m.milestone_grade_boast({ level })}
                        imageSvg={svgMilestone({
                            title: m.grades_current({ level }),
                            detail: skill > 0 ? m.grades_skill({ rating: skill }) : undefined,
                        })}
                        imageText={m.milestone_grade_boast({ level })}
                    />
                </section>
            )}

            {showOnboarding && (
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
                    <>
                        <Link
                            to="/review"
                            className="inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                        >
                            {m.review_start({ count: reviews.length })}
                        </Link>
                        <ul className="space-y-1 text-sm">
                            {reviews.map((id) => (
                                <li key={id}>
                                    <Link to={`/play/${id}`} className={LINK}>
                                        {byId.get(id)?.title ?? id}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </section>

            {summary && (
                <div>
                    <h2 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                        {m.progress_last_7_days()}
                    </h2>
                    <div className="flex h-32 items-end gap-2">
                        {summary.recent.map((day) => (
                            <div
                                key={day.date}
                                className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                                title={
                                    day.notes === 1
                                        ? m.progress_notes_one({ count: day.notes })
                                        : m.progress_notes_other({ count: day.notes })
                                }
                            >
                                <div
                                    className="w-full rounded-t bg-indigo-500"
                                    style={{ height: `${Math.round((day.notes / max) * 100)}%` }}
                                />
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {day.date.slice(5)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {fingerprint && (
                <ShareCard
                    grid={fingerprint}
                    caption={m.progress_share_caption()}
                    gridLabel={m.progress_grid_label()}
                    rowLabels={[m.scores_accuracy(), m.scores_timing(), m.scores_flow()]}
                    boast={m.progress_share_boast()}
                    heading={
                        summary
                            ? `Plinky ${summary.currentStreak}·${summary.daysPracticed}·${summary.totalNotes}`
                            : "Plinky"
                    }
                />
            )}

            <Link to="/" className="text-sm text-indigo-700 underline dark:text-indigo-300">
                {m.action_back_home()}
            </Link>
        </main>
    );
}

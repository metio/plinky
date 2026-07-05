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
} from "../../lib/gradeProgress";
import { progressGrid } from "../../../core/lifetime";
import { svgMilestone } from "../../../core/milestoneCard";
import { usePrefsStore, useServices } from "../../contexts/services";
import { usePracticeSummary } from "../../hooks/usePracticeSummary";
import { MAX_GRADE } from "../../../core/scoreDifficulty";
import type { Grid } from "../../../core/shareCard";
import { m } from "../../paraglide/messages.js";
import { buttonClasses } from "../ui/button";
import { Show } from "./conditional";
import { LocalizedLink as Link } from "../ui/localizedLink";
import { ShareButtons } from "./shareButtons";
import { ShareCard } from "./shareCard";

type EarnedTier = Exclude<StarTier, "none">;
const STAR: Record<EarnedTier, string> = { bronze: "🥉", silver: "🥈", gold: "🥇" };
const STAR_LABEL: Record<EarnedTier, () => string> = {
    bronze: m.grades_star_bronze,
    silver: m.grades_star_silver,
    gold: m.grades_star_gold,
};

// A one-line "what playing at this grade feels like" for each of the eight grades, for
// the optional "About this grade" disclosure — a go-deeper layer, never a reading gate.
const GRADE_ABOUT: Record<number, () => string> = {
    1: m.grade_about_1,
    2: m.grade_about_2,
    3: m.grade_about_3,
    4: m.grade_about_4,
    5: m.grade_about_5,
    6: m.grade_about_6,
    7: m.grade_about_7,
    8: m.grade_about_8,
};

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
// and activity (days, notes) up top; what to play next and the grade roadmap;
// the single refresh queue; then the retrospective — a 7-day chart and the lifetime
// Accuracy/Timing/Flow fingerprint. Reads mastery, the catalogue and practice history
// after mount, so the personal data is absent from the prerendered shell.
export function YouView() {
    const prefsStore = usePrefsStore();
    const services = useServices();
    const [items, setItems] = useState<GradedMastery[] | null>(null);
    const [catalogue, setCatalogue] = useState<GradeCatalogItem[]>([]);
    // Subscribed, not sampled: a run finished elsewhere updates the summary live.
    const summary = usePracticeSummary();
    const [fingerprint, setFingerprint] = useState<Grid | null>(null);

    useEffect(() => {
        let cancelled = false;
        setFingerprint(progressGrid(services.lifetime.load()));
        loadGradedMastery(services.mastery, services).then(
            (loaded) => !cancelled && setItems(loaded),
        );
        loadGradeCatalogue(services).then((loaded) => !cancelled && setCatalogue(loaded));
        return () => {
            cancelled = true;
        };
    }, [services]);

    // Wait for the personal data before painting anything, so the page renders once
    // fully rather than prerendering a roadmap that shifts as the data lands — the
    // whole page is client-only mastery/history, and a single paint keeps CLS at zero.
    if (items === null) {
        return null;
    }

    const now = Date.now();
    const prefs = prefsStore.load();
    const mode = prefs.decayMode;
    const resolved = items;
    const level = currentGrade(resolved);
    const skill = skillRating(resolved, mode, now);
    const reviews = dueReviews(resolved, now, prefs.reviewCap);
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
                    <span title={m.grades_skill_help()}>{m.grades_skill({ rating: skill })}</span>
                    <Show when={mode === "competitive"}>
                        <span
                            title={m.grades_competitive_help()}
                            className="font-medium text-amber-700 dark:text-amber-400"
                        >
                            ⚔️ {m.grades_competitive()}
                        </span>
                    </Show>
                </span>
            </div>

            {summary && (
                <div className="grid grid-cols-2 gap-4">
                    <Stat
                        label={m.progress_days_practiced()}
                        value={String(summary.daysPracticed)}
                    />
                    <Stat label={m.progress_notes_played()} value={String(summary.totalNotes)} />
                </div>
            )}

            <Show when={level >= 1}>
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
            </Show>

            <Show when={upNext.length > 0}>
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
            </Show>

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
                            className={`space-y-2 rounded-md border p-3 ${
                                grade === level
                                    ? "border-indigo-300 bg-indigo-50/60 dark:border-indigo-800 dark:bg-indigo-950/40"
                                    : "border-gray-200 dark:border-gray-800"
                            }`}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <span className="flex items-center gap-2">
                                    <span className="font-semibold">
                                        {m.grades_grade({ grade })}
                                    </span>
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
                                    <Show when={due > 0}>
                                        <span className="text-amber-700 dark:text-amber-400">
                                            {m.grades_due({ count: due })}
                                        </span>
                                    </Show>
                                </span>
                            </div>
                            <details className="text-sm">
                                <summary className="cursor-pointer text-xs text-gray-500 dark:text-gray-400">
                                    {m.grade_about_heading()}
                                </summary>
                                <p className="pt-1 text-gray-600 dark:text-gray-400">
                                    {GRADE_ABOUT[grade]?.()}
                                </p>
                            </details>
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
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {m.refresh_why()}
                        </p>
                        <Link to="/review" className={buttonClasses("primary")}>
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
                        summary ? `Plinky ${summary.daysPracticed}·${summary.totalNotes}` : "Plinky"
                    }
                />
            )}

            <Link to="/" className="text-sm text-indigo-700 underline dark:text-indigo-300">
                {m.action_back_home()}
            </Link>
        </main>
    );
}

// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { DecayMode } from "../../../core/review";
import { MAX_GRADE } from "../../../core/scoreDifficulty";
import {
    type GradedMastery,
    gradeFreshness,
    masteredInGrade,
    nextStar,
    type StarTier,
    starTier,
} from "../../lib/gradeProgress";
import { m } from "../../paraglide/messages.js";
import { Show } from "./conditional";
import { LocalizedLink as Link } from "../ui/localizedLink";

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

// The roadmap: one row per grade with its earned star, mastered-of-pool count,
// distance to the next star, any due refreshes, and the optional about line. The
// current grade's row is highlighted as "you are here".
export function GradeRoadmap({
    items,
    level,
    mode,
    now,
}: {
    items: GradedMastery[];
    level: number;
    mode: DecayMode;
    now: number;
}) {
    const grades = Array.from({ length: MAX_GRADE }, (_, i) => i + 1);
    return (
        <ul className="space-y-2">
            {grades.map((grade) => {
                const mastered = masteredInGrade(items, grade, mode, now);
                const tier = starTier(mastered);
                const next = nextStar(mastered);
                const { due } = gradeFreshness(items, grade, mode, now);
                return (
                    <li
                        key={grade}
                        className={`space-y-2 rounded-md border p-3 ${
                            grade === level
                                ? "border-accent-line-strong bg-accent-surface/60 dark:bg-accent-surface/40"
                                : "border-line"
                        }`}
                    >
                        <div className="flex items-center justify-between gap-3">
                            {/* The grade opens its pieces. A ladder of eight rows that
                                cannot be pressed reads as a level-select screen; being
                                able to press Grade 8 on your first day, and land on four
                                hundred pieces you may play, says what no sentence can. */}
                            <Link
                                to={`/library?grade=${grade}`}
                                className="flex items-center gap-2 rounded-md px-1 hover:text-accent-strong hover:underline"
                            >
                                <span className="font-semibold">{m.grades_grade({ grade })}</span>
                                {tier !== "none" && (
                                    <span role="img" aria-label={STAR_LABEL[tier]()}>
                                        {STAR[tier]}
                                    </span>
                                )}
                            </Link>
                            <span className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-sm text-muted">
                                {/* No ratio. The pool is four hundred pieces a grade —
                                    a denominator nobody is meant to finish, and printing
                                    it turns a shelf into a requirement. What guides is the
                                    distance to the next star, which is right beside it. */}
                                <span className="text-muted">
                                    {next
                                        ? m.grades_to_next({
                                              count: next.remaining,
                                              tier: STAR_LABEL[next.tier](),
                                          })
                                        : m.grades_maxed()}
                                </span>
                                <Show when={due > 0}>
                                    <span className="text-warn">
                                        {m.grades_due({ count: due })}
                                    </span>
                                </Show>
                            </span>
                        </div>
                        <details className="text-sm">
                            <summary className="cursor-pointer text-xs text-muted">
                                {m.grade_about_heading()}
                            </summary>
                            <p className="pt-1 text-muted">{GRADE_ABOUT[grade]?.()}</p>
                        </details>
                    </li>
                );
            })}
        </ul>
    );
}

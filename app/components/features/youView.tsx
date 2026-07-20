// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { monthKey, monthlyRecap } from "../../../core/history";
import { svgMilestone } from "../../../core/milestoneCard";
import { practiceHref } from "../../../core/practisable";
import { useHistoryStore } from "../../contexts/services";
import { useYouData } from "../../hooks/useYouData";
import { m } from "../../paraglide/messages.js";
import { linkClasses } from "../ui/classes";
import { LocalizedLink as Link } from "../ui/localizedLink";
import { AchievementGallery } from "./achievementGallery";
import { Show } from "./conditional";
import { GradeRoadmap } from "./gradeRoadmap";
import { RecapCard } from "./recapCard";
import { RefreshQueue } from "./refreshQueue";
import { ShareButtons } from "./shareButtons";
import { ShareCard } from "./shareCard";
import { WeekChart } from "./weekChart";
import { ActivityStats, YouStanding } from "./youStanding";

// The "You" page: how good you are at playing, in one place. Standing (grade + skill)
// and activity (days, notes) up top; what to play next and the grade roadmap;
// the single refresh queue; then the retrospective — a 7-day chart and the lifetime
// Accuracy/Timing/Flow fingerprint. All the data arrives through useYouData, which
// waits for the personal data before the page paints anything — a single full paint
// keeps CLS at zero on this client-only page.
export function YouView() {
    const data = useYouData();
    const history = useHistoryStore();
    if (data === null) {
        return null;
    }
    const { level, skill, mode, workingGrade, upNext, summary, fingerprint } = data;
    // This calendar month's practice, for the recap card — shown only when the month has
    // something to celebrate, so it reads as a reward rather than an empty prompt.
    const recap = monthlyRecap(history.load(), monthKey(new Date()));

    return (
        <main className="mx-auto max-w-3xl space-y-5 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">{m.you_heading()}</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">{m.you_intro()}</p>
            </header>

            <YouStanding level={level} skill={skill} competitive={mode === "competitive"} />

            {summary && (
                <ActivityStats
                    daysPracticed={summary.daysPracticed}
                    totalNotes={summary.totalNotes}
                />
            )}

            {recap.totalNotes > 0 && <RecapCard recap={recap} />}

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
                                <Link to={practiceHref(item)} className={linkClasses}>
                                    {item.title}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            </Show>

            <GradeRoadmap
                items={data.items}
                level={level}
                mode={mode}
                now={data.now}
                poolSizes={data.poolSizes}
            />

            <RefreshQueue reviews={data.reviews} />

            <AchievementGallery achievements={data.achievements} />

            {summary && <WeekChart recent={summary.recent} />}

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
        </main>
    );
}

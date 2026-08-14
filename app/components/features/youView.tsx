// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { monthKey, monthlyRecap } from "../../../core/history";
import { svgMilestone } from "../../../core/milestoneCard";
import { practiceHref } from "../../../core/practisable";
import { useHistoryStore } from "../../contexts/services";
import { useYouData } from "../../hooks/useYouData";
import { m } from "../../paraglide/messages.js";
import { linkClasses } from "../ui/classes";
import { SettingsSection } from "../ui/settingsSection";
import { LocalizedLink as Link } from "../ui/localizedLink";
import { BakedIncipit } from "../ui/incipit";
import { AchievementGallery } from "./achievementGallery";
import { Show } from "./conditional";
import { GradeRoadmap } from "./gradeRoadmap";
import { PracticeReport } from "./practiceReport";
import { RepertoirePanel } from "./repertoirePanel";
import { RecapCard } from "./recapCard";
import { FeatureBoundary } from "./featureBoundary";
import { SlowNotes } from "./slowNotes";
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
    // The diary stores catalogue ids; the titles live with the graded items this page
    // already loaded, so resolving here costs nothing and keeps the report ignorant of
    // the library. An id with no match is shown as itself — a piece removed from the
    // library should not erase the practice done on it.
    const titles = new Map(data.items.map((item) => [item.id, item.title]));
    const pieceTitle = (id: string) => titles.get(id) ?? id;

    return (
        <main className="mx-auto max-w-3xl space-y-8 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="font-display text-3xl font-semibold tracking-tight">
                    {m.you_heading()}
                </h1>
                <p className="text-sm text-muted">{m.you_intro()}</p>
            </header>

            <YouStanding level={level} skill={skill} competitive={mode === "competitive"} />

            {/* The page's own intro promises three things — where you stand, what is
                ready for you, and how it has been going — and for a long time it
                delivered twelve blocks in the order they were built. What you could act
                on now comes first, the ladder underneath it, and the record of how it
                went after both, so the page reads forwards. */}
            <Show when={upNext.length > 0}>
                <SettingsSection title={m.grades_up_next({ grade: workingGrade })}>
                    <ul className="space-y-1 text-sm">
                        {upNext.map((item) => (
                            <li key={item.id} className="flex items-center gap-2">
                                {/* Drawn the way every other list of pieces names one:
                                    the opening bars, then the title. */}
                                <BakedIncipit mark={item.incipit} label={item.title} />
                                <Link to={practiceHref(item)} className={linkClasses}>
                                    {item.title}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </SettingsSection>
            </Show>

            <FeatureBoundary feature="RefreshQueue">
                <RefreshQueue reviews={data.reviews} />
            </FeatureBoundary>

            {/* Named and framed like every other block on the page — and the frame is
                where the app finally says out loud what has always been true of it. */}
            <SettingsSection title={m.grades_roadmap_heading()} hint={m.grades_roadmap_hint()}>
                <GradeRoadmap items={data.items} level={level} mode={mode} now={data.now} />
            </SettingsSection>

            {/* Where the ladder starts for someone who has no idea. It answers the
                question the roadmap raises, so it sits directly under it. */}
            <SettingsSection title={m.placement_cta()} hint={m.placement_cta_hint()}>
                <Link to="/placement" className={`${linkClasses} inline-block text-sm`}>
                    {m.placement_start()} →
                </Link>
            </SettingsSection>

            <FeatureBoundary feature="AchievementGallery">
                <AchievementGallery achievements={data.achievements} />
            </FeatureBoundary>

            <FeatureBoundary feature="RepertoirePanel">
                <RepertoirePanel items={data.items} now={new Date()} />
            </FeatureBoundary>

            {/* Both count what has happened, so before anything has they are a pair of
                zeros over an empty week — a frame promising insight it does not have. The
                diary below says the same thing in a sentence, and offers what to do. */}
            {summary && (summary.daysPracticed > 0 || summary.totalNotes > 0) && (
                <SettingsSection title={m.progress_all_time()}>
                    {/* Said out loud, because the month's recap further down counts the
                        same two things and a reader cannot tell two unlabelled pairs of
                        numbers apart. */}
                    <ActivityStats
                        daysPracticed={summary.daysPracticed}
                        totalNotes={summary.totalNotes}
                    />
                    <FeatureBoundary feature="WeekChart">
                        <WeekChart recent={summary.recent} />
                    </FeatureBoundary>
                </SettingsSection>
            )}

            <FeatureBoundary feature="PracticeReport">
                <PracticeReport pieceTitle={pieceTitle} />
            </FeatureBoundary>

            <FeatureBoundary feature="SlowNotes">
                <SlowNotes />
            </FeatureBoundary>

            {/* Everything worth showing somebody else, together at the foot rather than
                a share button in the middle of the page and a share card at the end. */}
            {recap.totalNotes > 0 && (
                <FeatureBoundary feature="RecapCard">
                    <RecapCard recap={recap} />
                </FeatureBoundary>
            )}

            <Show when={level >= 1}>
                <SettingsSection title={m.grades_share_heading()}>
                    <ShareButtons
                        text={m.milestone_grade_boast({ level })}
                        imageSvg={svgMilestone({
                            title: m.grades_current({ level }),
                            detail: skill > 0 ? m.grades_skill({ rating: skill }) : undefined,
                        })}
                        imageText={m.milestone_grade_boast({ level })}
                    />
                </SettingsSection>
            </Show>

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

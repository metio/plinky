// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { usePrefs } from "../../hooks/usePrefs";
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
import { GoingBlock } from "./goingBlock";
import { GradeRoadmap } from "./gradeRoadmap";
import { RepertoirePanel } from "./repertoirePanel";
import { FeatureBoundary } from "./featureBoundary";
import { RefreshQueue } from "./refreshQueue";
import { ShareButtons } from "./shareButtons";
import { ShareCard } from "./shareCard";
import { StandingKey, YouStanding } from "./youStanding";
import { PageHeader } from "../ui/pageHeader";

// The "You" page: how good you are at playing, in one place. Standing (grade + skill)
// and activity (days, notes) up top; what to play next and the grade roadmap;
// the single refresh queue; then the retrospective — a 7-day chart and the lifetime
// Accuracy/Timing/Flow fingerprint. All the data arrives through useYouData, which
// waits for the personal data before the page paints anything — a single full paint
// keeps CLS at zero on this client-only page.
export function StatsView() {
    // The reading aid that colours noteheads in a score colours these opening bars
    // too, read once for the whole list rather than per mark.
    const { prefs } = usePrefs();
    const data = useYouData();
    const history = useHistoryStore();
    if (data === null) {
        return null;
    }
    const { level, skill, mode, workingGrade, upNext, summary, fingerprint } = data;
    // The diary stores catalogue ids; the titles live with the graded items this page
    // already loaded, so resolving here costs nothing and keeps the report ignorant of
    // the library. An id with no match is shown as itself — a piece removed from the
    // library should not erase the practice done on it.
    const titles = new Map(data.items.map((item) => [item.id, item.title]));
    const pieceTitle = (id: string) => titles.get(id) ?? id;

    return (
        <main className="mx-auto max-w-3xl space-y-8 p-6 font-sans">
            <PageHeader title={m.stats_heading()} hint={m.stats_intro()} />

            {/* Four blocks, and membership follows one rule a reader can feel: is this
                number about a period, or not? Everything periodic lives in the last block
                and nowhere else. The page used to be fourteen siblings in the order they
                were built, carrying six different windows of time between them. */}
            <SettingsSection title={m.you_block_standing()} hint={m.you_block_standing_hint()}>
                <div className="space-y-4">
                    <YouStanding level={level} skill={skill} competitive={mode === "competitive"} />
                    {/* A legend, folded into the thing it explains rather than standing
                        beside it as a section of equal weight. */}
                    <StandingKey />
                </div>
            </SettingsSection>

            <SettingsSection title={m.you_block_ready()} hint={m.you_block_ready_hint()}>
                <div className="space-y-6">
                    <Show when={upNext.length > 0}>
                        <div className="space-y-2">
                            <h3 className="text-sm font-medium text-body">
                                {m.grades_up_next({ grade: workingGrade })}
                            </h3>
                            <ul className="space-y-1 text-sm">
                                {upNext.map((item) => (
                                    <li key={item.id} className="flex items-center gap-2">
                                        {/* Drawn the way every other list of pieces names
                                            one: the opening bars, then the title. */}
                                        <BakedIncipit
                                            mark={item.incipit}
                                            label={item.title}
                                            colored={prefs.colorNotes}
                                        />
                                        <Link to={practiceHref(item)} className={linkClasses}>
                                            {item.title}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </Show>

                    <FeatureBoundary feature="RefreshQueue">
                        <RefreshQueue reviews={data.reviews} />
                    </FeatureBoundary>
                </div>
            </SettingsSection>

            <SettingsSection title={m.you_block_ladder()} hint={m.you_block_ladder_hint()}>
                <div className="space-y-6">
                    <div className="space-y-2">
                        <h3 className="text-sm font-medium text-body">
                            {m.grades_roadmap_heading()}
                        </h3>
                        {/* The promise the app makes about grades, kept where the ladder
                            is: a grade says what to expect, never what you may play. */}
                        <p className="text-xs text-muted">{m.grades_roadmap_hint()}</p>
                        <GradeRoadmap items={data.items} level={level} mode={mode} now={data.now} />
                    </div>

                    {/* Where the ladder starts for somebody who has no idea. Two lines in
                        the footer of the ladder it is about, rather than a section of its
                        own that only ever pointed somewhere else. */}
                    <div className="space-y-1">
                        <Link to="/placement" className={`${linkClasses} inline-block text-sm`}>
                            {m.you_find_level()}
                        </Link>
                        <p className="text-xs text-muted">{m.placement_cta_hint()}</p>
                    </div>

                    <FeatureBoundary feature="RepertoirePanel">
                        <RepertoirePanel items={data.items} now={new Date()} />
                    </FeatureBoundary>

                    <FeatureBoundary feature="AchievementGallery">
                        <AchievementGallery achievements={data.achievements} />
                    </FeatureBoundary>
                </div>
            </SettingsSection>

            <FeatureBoundary feature="GoingBlock">
                <GoingBlock
                    history={history.load()}
                    summary={summary}
                    pieceTitle={pieceTitle}
                    // data.now is the epoch millisecond the page's data was read at — the
                    // same instant every figure in the block is measured against, so the
                    // window and its contents cannot disagree.
                    now={new Date(data.now)}
                />
            </FeatureBoundary>

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

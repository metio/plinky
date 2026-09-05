// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useHistoryStore } from "../../contexts/services";
import { useStatsData } from "../../hooks/useStatsData";
import { m } from "../../paraglide/messages.js";
import { linkClasses } from "../ui/classes";
import { SettingsSection } from "../ui/settingsSection";
import { LocalizedLink as Link } from "../ui/localizedLink";
import { AchievementGallery } from "./achievementGallery";
import { monthOverMonth } from "../../../core/statsScope";
import { GoingBlock } from "./goingBlock";
import { PracticeBalance } from "./practiceBalance";
import { Show } from "./conditional";
import { SlowNotes } from "./slowNotes";
import { GradeRoadmap } from "./gradeRoadmap";
import { RepertoirePanel } from "./repertoirePanel";
import { FeatureBoundary } from "./featureBoundary";
import { RefreshQueue } from "./refreshQueue";
import { svgMilestone } from "../../../core/milestoneCard";
import { ShareButtons } from "./shareButtons";
import { ShareCard } from "./shareCard";
import { StandingKey, Standing } from "./standing";
import { PageHeader } from "../ui/pageHeader";

// The "You" page: how good you are at playing, in one place. Standing (grade + skill)
// and activity (days, notes) up top; what to play next and the grade roadmap;
// the single refresh queue; then the retrospective — a 7-day chart and the lifetime
// Accuracy/Timing/Flow fingerprint. All the data arrives through useStatsData, which
// waits for the personal data before the page paints anything — a single full paint
// keeps CLS at zero on this client-only page.
export function StatsView() {
    const data = useStatsData();
    const history = useHistoryStore();
    if (data === null) {
        return null;
    }
    const { level, skill, mode, summary, fingerprint } = data;
    // The diary stores catalogue ids; the titles live with the graded items this page
    // already loaded, so resolving here costs nothing and keeps the report ignorant of
    // the library. An id with no match is shown as itself — a piece removed from the
    // library should not erase the practice done on it.
    const titles = new Map(data.items.map((item) => [item.id, item.title]));
    const pieceTitle = (id: string) => titles.get(id) ?? id;

    const opening = monthOverMonth(history.load(), new Date(data.now));

    return (
        <main className="mx-auto max-w-3xl space-y-8 p-6 font-sans">
            <PageHeader title={m.stats_heading()} hint={m.stats_intro()} />

            {/* One line of your own figures before the questions start. Days rather than
                notes, and it says what happened rather than calling it better: more days is
                not better playing, and a page that graded a month would be a page you could
                fail. Nothing here counts consecutive days. */}
            <p className="text-base text-body">
                {opening.first
                    ? m.stats_opening_first()
                    : opening.more !== null
                      ? m.stats_opening_days_more({ days: opening.days, more: opening.more })
                      : m.stats_opening_days({ days: opening.days })}
            </p>

            {/* Six questions a player actually asks, each heading the answer beneath it.
                Membership never needs explaining, which is what sank the version before
                this: four blocks whose contents you had to be told about, laid over the
                fourteen sections that were still emitting their own headings inside. */}
            <SettingsSection title={m.stats_q_standing()} hint={m.stats_q_standing_hint()}>
                <div className="space-y-4">
                    <Standing level={level} skill={skill} competitive={mode === "competitive"} />
                    <StandingKey />
                    {/* Where the ladder starts for somebody who has no idea — a line under
                        the answer it belongs to, not a section that only pointed away. */}
                    <div className="space-y-1">
                        <Link to="/placement" className={`${linkClasses} inline-block text-sm`}>
                            {m.stats_find_level()}
                        </Link>
                        <p className="text-xs text-muted">{m.placement_cta_hint()}</p>
                    </div>
                </div>
            </SettingsSection>

            <SettingsSection title={m.stats_q_better()} hint={m.stats_q_better_hint()}>
                <FeatureBoundary feature="GoingBlock">
                    <GoingBlock
                        history={history.load()}
                        pieceTitle={pieceTitle}
                        // data.now is the epoch millisecond the page's data was read at —
                        // the same instant every figure is measured against, so a window
                        // and its contents cannot disagree.
                        now={new Date(data.now)}
                    />
                </FeatureBoundary>
            </SettingsSection>

            {/* What is on the stand, and what has gone stale on it. The list of pieces at
                your grade you have NOT played used to sit here too; it answers "what shall I
                do", which is the home page's whole job, and having it in both places let two
                surfaces disagree about what you owe. */}
            <SettingsSection title={m.stats_q_working()} hint={m.stats_q_working_hint()}>
                <div className="space-y-6">
                    <FeatureBoundary feature="RepertoirePanel">
                        <RepertoirePanel
                            items={data.items}
                            now={new Date(data.now)}
                            headed={false}
                        />
                    </FeatureBoundary>
                    <FeatureBoundary feature="RefreshQueue">
                        <RefreshQueue reviews={data.reviews} headed={false} />
                    </FeatureBoundary>
                </div>
            </SettingsSection>

            {/* Both of these are about HOW you play rather than when, so neither follows the
                period dial — which is why they sit here and not in the block above. The
                apology line that used to stand in for the slow notes on other periods is
                gone with the reason for it. */}
            <SettingsSection title={m.stats_q_strongest()} hint={m.stats_q_strongest_hint()}>
                <div className="space-y-6">
                    <FeatureBoundary feature="PracticeBalance">
                        <PracticeBalance pieceTitle={pieceTitle} now={data.now} headed={false} />
                    </FeatureBoundary>
                    <FeatureBoundary feature="SlowNotes">
                        <SlowNotes headed={false} />
                    </FeatureBoundary>
                </div>
            </SettingsSection>

            <SettingsSection title={m.stats_q_ladder()} hint={m.stats_q_ladder_hint()}>
                <div className="space-y-6">
                    <div className="space-y-2">
                        {/* The promise the app makes about grades, kept where the ladder is:
                            a grade says what to expect, never what you may play. */}
                        <p className="text-xs text-muted">{m.grades_roadmap_hint()}</p>
                        <GradeRoadmap items={data.items} level={level} mode={mode} now={data.now} />
                    </div>
                    <FeatureBoundary feature="AchievementGallery">
                        <AchievementGallery achievements={data.achievements} framed={false} />
                    </FeatureBoundary>
                </div>
            </SettingsSection>

            {/* Both ways of showing somebody, under one heading. The fingerprint card used
                to hang at the foot of the page with no heading at all — its own caption
                said "Share your progress", which is also what the section above it was
                called, so the page said it twice and titled it never. */}
            {/* One way of showing somebody, never two and never none.
                The card carries its own row of platform buttons — every share surface in
                the app is that same row — so putting a second set beside it drew every
                platform twice under one heading. They used to sit in different parts of the
                page, which hid the repeat rather than avoiding it; gathering them is what
                made it visible.
                The card needs a fingerprint, which needs practice. Before there is any, the
                grade is what there is to show, and once neither exists the section has
                nothing to say and does not appear at all. */}
            <Show when={fingerprint !== null || level >= 1}>
                <SettingsSection title={m.stats_q_share()} hint={m.stats_q_share_hint()}>
                    {fingerprint ? (
                        <ShareCard
                            grid={fingerprint}
                            caption={m.progress_share_caption()}
                            gridLabel={m.progress_grid_label()}
                            rowLabels={[m.scores_accuracy(), m.scores_timing(), m.scores_flow()]}
                            boast={m.progress_share_boast()}
                            heading={
                                summary
                                    ? `Plinky ${summary.daysPracticed}·${summary.totalNotes}`
                                    : "Plinky"
                            }
                        />
                    ) : (
                        <ShareButtons
                            text={m.milestone_grade_boast({ level })}
                            imageSvg={svgMilestone({
                                title: m.grades_current({ level }),
                                detail: skill > 0 ? m.grades_skill({ rating: skill }) : undefined,
                            })}
                            imageText={m.milestone_grade_boast({ level })}
                        />
                    )}
                </SettingsSection>
            </Show>
        </main>
    );
}

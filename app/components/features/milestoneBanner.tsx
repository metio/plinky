// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useMilestoneChannel } from "../../contexts/milestone";
import { svgMilestone } from "../../../core/milestoneCard";
import type { Milestone } from "../../../core/milestones";
import { m } from "../../paraglide/messages.js";
import { ShareButtons } from "./shareButtons";

// A celebratory notice for an earned moment (first S, grade-up, flawless run), with the
// matching share card to post. It sits app-wide below the header — an earned moment is
// worth the same beat wherever the run happened, and this is the one place it shows — and
// dismisses on the ✕ or the next run.
export function MilestoneBanner({
    milestone,
    onDismiss,
}: {
    milestone: Milestone;
    onDismiss: () => void;
}) {
    const heading =
        milestone.kind === "grade-up"
            ? m.milestone_grade_heading({ level: milestone.grade })
            : milestone.kind === "flawless"
              ? m.milestone_flawless_heading({ title: milestone.songTitle })
              : m.milestone_first_s_heading({ title: milestone.songTitle });
    const cardTitle =
        milestone.kind === "grade-up"
            ? m.grades_current({ level: milestone.grade })
            : milestone.kind === "flawless"
              ? m.milestone_flawless_title()
              : m.milestone_first_s_title();
    const detail =
        milestone.kind === "grade-up"
            ? milestone.skill > 0
                ? m.grades_skill({ rating: milestone.skill })
                : undefined
            : milestone.songTitle;
    const boast =
        milestone.kind === "grade-up"
            ? m.milestone_grade_boast({ level: milestone.grade })
            : milestone.kind === "flawless"
              ? m.milestone_flawless_boast({ title: milestone.songTitle })
              : m.milestone_first_s_boast({ title: milestone.songTitle });
    return (
        <div
            role="status"
            className="border-b border-indigo-300 bg-indigo-50 px-6 py-3 dark:border-indigo-800 dark:bg-indigo-950"
        >
            <div className="mx-auto max-w-3xl space-y-2">
                <div className="flex items-start justify-between gap-4">
                    <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">
                        {heading}
                    </p>
                    <button
                        type="button"
                        onClick={onDismiss}
                        aria-label={m.action_dismiss()}
                        className="shrink-0 text-indigo-900 hover:text-indigo-700 dark:text-indigo-200 dark:hover:text-indigo-100"
                    >
                        ✕
                    </button>
                </div>
                <ShareButtons
                    text={boast}
                    imageSvg={svgMilestone({ title: cardTitle, detail })}
                    imageText={boast}
                />
            </div>
        </div>
    );
}

// The app shell's single subscriber to the earned-moment channel: it renders the banner
// when a run has published a milestone, and nothing otherwise.
export function MilestoneBannerHost() {
    const { current, dismiss } = useMilestoneChannel();
    if (!current) {
        return null;
    }
    return <MilestoneBanner milestone={current} onDismiss={dismiss} />;
}

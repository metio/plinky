// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Achievement, EarBadge } from "../../../core/achievements";
import { m } from "../../paraglide/messages.js";
import { SettingsSection } from "../ui/settingsSection";
import { Folio, FolioRow } from "../ui/folio";

const STAR_EMOJI: Record<string, string> = { bronze: "🥉", silver: "🥈", gold: "🥇" };
const STAR_LABEL: Record<string, () => string> = {
    bronze: m.grades_star_bronze,
    silver: m.grades_star_silver,
    gold: m.grades_star_gold,
};

function badgeFace(badge: Achievement): { emoji: string; label: string } {
    switch (badge.kind) {
        case "grade":
            return { emoji: "🎓", label: m.grades_grade({ grade: badge.grade }) };
        case "star":
            return {
                emoji: STAR_EMOJI[badge.tier] ?? "⭐",
                label: m.achievement_star({ tier: STAR_LABEL[badge.tier]?.() ?? badge.tier }),
            };
        case "firstS":
            return { emoji: "🌟", label: m.achievement_first_s() };
        case "flawless":
            return { emoji: "💯", label: m.achievement_flawless() };
        case "days":
            return { emoji: "📅", label: m.achievement_days({ count: badge.target }) };
        case "notes":
            return { emoji: "🎵", label: m.achievement_notes({ count: badge.target }) };
        case "ear":
            return EAR_FACE[badge.badge];
    }
}

const EAR_FACE: Record<EarBadge, { emoji: string; label: string }> = {
    first: { emoji: "👂", label: m.achievement_ear_first() },
    flawless: { emoji: "🎯", label: m.achievement_ear_flawless() },
    mastered: { emoji: "🏆", label: m.achievement_ear_mastered() },
};

// The trophy shelf: every badge in one grid, earned ones lit, the rest dimmed
// as visible goals. Badges are cumulative and permanent — a break never takes
// one away — so the shelf only ever fills up.
export function AchievementGallery({
    achievements,
    framed = true,
}: {
    achievements: Achievement[];
    // Whether the gallery frames itself. Inside one of the Stats page's questions it is
    // part of the answer rather than a section of its own — a card nested in a card was
    // two frames deep for one idea. Elsewhere it keeps its own frame.
    framed?: boolean;
}) {
    // Two columns of rows from a tablet's width up, each with its own margin, filled left to
    // right; one column on a phone. The last row of the left column closes with a rule too,
    // when the shelf ends on the right.
    const grid = (
        <Folio className="md:grid-cols-[minmax(5.25rem,auto)_minmax(0,1fr)_minmax(5.25rem,auto)_minmax(0,1fr)] md:[&>li:nth-last-child(2):nth-child(odd)]:border-b">
            {achievements.map((badge) => {
                const { emoji, label } = badgeFace(badge);
                // A greyed glyph under a padlock is the vocabulary of something locked,
                // and nothing here is — these are simply the ones that have not happened
                // yet. So an unearned badge keeps its row and only its emoji is quieter:
                // fading the label too would sink it below the contrast floor.
                return (
                    <FolioRow
                        key={badge.id}
                        size="compact"
                        margin={
                            <span
                                aria-hidden="true"
                                className={`text-2xl ${badge.earned ? "" : "opacity-50"}`}
                            >
                                {emoji}
                            </span>
                        }
                        name={
                            <>
                                <span className={badge.earned ? "" : "text-muted"}>{label}</span>
                                <span className="sr-only">
                                    {badge.earned ? m.achievement_earned() : m.achievement_locked()}
                                </span>
                            </>
                        }
                    />
                );
            })}
        </Folio>
    );
    return framed ? (
        <SettingsSection title={m.achievements_heading()} hint={m.achievements_hint()}>
            {grid}
        </SettingsSection>
    ) : (
        grid
    );
}

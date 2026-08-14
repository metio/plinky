// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Achievement, EarBadge } from "../../../core/achievements";
import { m } from "../../paraglide/messages.js";
import { SettingsSection } from "../ui/settingsSection";

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
export function AchievementGallery({ achievements }: { achievements: Achievement[] }) {
    return (
        <SettingsSection title={m.achievements_heading()} hint={m.achievements_hint()}>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {achievements.map((badge) => {
                    const { emoji, label } = badgeFace(badge);
                    return (
                        <li
                            key={badge.id}
                            // A dashed outline and a greyed glyph is the vocabulary of a
                            // padlock, and nothing here is locked — these are simply the
                            // ones that have not happened yet. Same frame as an earned
                            // badge, quieter ground.
                            className={`flex flex-col items-center gap-1 rounded-xl border border-line p-3 text-center ${
                                badge.earned
                                    ? "border-accent-line bg-accent-surface/60 dark:bg-accent-surface/40"
                                    : ""
                            }`}
                        >
                            {/* Only the decorative emoji dims for a locked badge — fading
                                the label too would sink it below the contrast floor. */}
                            <span
                                aria-hidden="true"
                                className={`text-2xl ${badge.earned ? "" : "opacity-50"}`}
                            >
                                {emoji}
                            </span>
                            <span
                                className={`text-xs font-medium ${
                                    badge.earned ? "text-body" : "text-muted"
                                }`}
                            >
                                {label}
                            </span>
                            <span className="sr-only">
                                {badge.earned ? m.achievement_earned() : m.achievement_locked()}
                            </span>
                        </li>
                    );
                })}
            </ul>
        </SettingsSection>
    );
}

// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import type { DecayMode } from "../../core/review";
import { progressGrid } from "../../core/lifetime";
import { MAX_GRADE } from "../../core/scoreDifficulty";
import type { Grid } from "../../core/shareCard";
import { type Achievement, collectAchievements, type StarKind } from "../../core/achievements";
import { letterFor } from "../../core/grade";
import type { PracticeSummary } from "../../core/history";
import {
    currentGrade,
    dueReviews,
    type GradeCatalogItem,
    type GradedMastery,
    gradeSuggestions,
    loadGradeCatalogue,
    loadGradedMastery,
    masteredInGrade,
    poolSizes,
    skillRating,
    starTier,
} from "../lib/gradeProgress";
import { useServices } from "../contexts/services";
import { usePracticeSummary } from "./usePracticeSummary";
import { usePrefs } from "./usePrefs";

const SUGGESTION_COUNT = 4;

export type YouData = {
    // Every graded piece with its mastery — the input the roadmap breaks down per grade.
    items: GradedMastery[];
    mode: DecayMode;
    now: number;
    level: number;
    skill: number;
    // The grade being worked toward: one past the current level, capped at the top.
    workingGrade: number;
    // The gentlest unmastered pieces of the working grade — what to play next.
    upNext: GradeCatalogItem[];
    // Pieces due a refresh, resolved to titles for linking.
    reviews: Array<{ id: string; title: string }>;
    // How many catalogue pieces each grade holds.
    poolSizes: Map<number, number>;
    summary: PracticeSummary | null;
    fingerprint: Grid | null;
    // The collectible badge set, earned flags included.
    achievements: Achievement[];
};

// Everything the "You" page shows, loaded once per mount and derived in one
// place: mastery and the catalogue arrive async (the personal data is absent
// from the prerendered shell), the practice summary and preferences are live
// subscriptions, and the standing/roadmap/review numbers fall out of the pure
// gradeProgress helpers. Null until the mastery has loaded, so the page can
// paint exactly once, fully.
export function useYouData(): YouData | null {
    const services = useServices();
    const { prefs } = usePrefs();
    const summary = usePracticeSummary();
    const [items, setItems] = useState<GradedMastery[] | null>(null);
    const [catalogue, setCatalogue] = useState<GradeCatalogItem[]>([]);
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

    if (items === null) {
        return null;
    }

    const now = Date.now();
    const mode = prefs.decayMode;
    const level = currentGrade(items);
    const byId = new Map(items.map((item) => [item.id, item]));
    const masteredIds = new Set(
        items.filter((item) => item.mastery.learned && !item.mastery.backlog).map((i) => i.id),
    );
    const workingGrade = Math.min(level + 1, MAX_GRADE);

    // Badge facts are counted cumulatively: the celebrated grade never lowers,
    // best scores never drop, and stars are judged under gentle decay — so an
    // earned badge can never quietly disappear.
    const stars = new Set<StarKind>();
    for (let grade = 1; grade <= MAX_GRADE; grade++) {
        const tier = starTier(masteredInGrade(items, grade, "gentle", now));
        if (tier !== "none") {
            stars.add(tier);
        }
    }
    const achievements = collectAchievements({
        reachedGrade: Math.max(services.milestones.reachedGrade(), level),
        hasS: items.some((item) => letterFor(item.mastery.bestScore) === "S"),
        flawless: services.milestones.flawlessDone(),
        stars,
        daysPracticed: summary?.daysPracticed ?? 0,
        totalNotes: summary?.totalNotes ?? 0,
    });

    return {
        items,
        mode,
        now,
        level,
        skill: skillRating(items, mode, now),
        workingGrade,
        upNext: gradeSuggestions(catalogue, workingGrade, masteredIds, SUGGESTION_COUNT),
        reviews: dueReviews(items, now, prefs.reviewCap).map((id) => ({
            id,
            title: byId.get(id)?.title ?? id,
        })),
        poolSizes: poolSizes(catalogue),
        summary,
        fingerprint,
        achievements,
    };
}

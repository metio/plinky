// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { type EarItem, EAR_ITEMS } from "../../core/earCatalog";
import { m } from "../paraglide/messages.js";

// The ear items as they appear on the grade ladder. core/earCatalog owns their ids,
// grades and costs — the language-neutral difficulty — and this is where each gains a
// translated title, the same split the rest of the catalogue keeps. The titles reuse the
// exercise and level names the /ear page already shows, so a grade-ladder entry reads
// exactly like the round that earned it.

const LEVEL_NAMES: (() => string)[] = [
    m.ear_level_fifths,
    m.ear_level_thirds,
    m.ear_level_seconds,
    m.ear_level_all,
];

export function earItemTitle(item: EarItem): string {
    if (item.exercise === "intervals" && item.level !== null) {
        const level = LEVEL_NAMES[item.level];
        return level ? `${m.ear_exercise_intervals()} · ${level()}` : m.ear_exercise_intervals();
    }
    return m.ear_exercise_perfect_pitch();
}

// Structurally a GradeCatalogItem[] — the shape is stated inline rather than imported so
// the catalogue can depend on the ear items without the ear items depending back on it.
export function earCatalogItems(): {
    id: string;
    title: string;
    grade: number;
    cost: number;
    kind: "ear";
}[] {
    return EAR_ITEMS.map((item) => ({
        id: item.id,
        title: earItemTitle(item),
        grade: item.grade,
        cost: item.cost,
        kind: "ear" as const,
    }));
}

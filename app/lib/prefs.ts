// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Letter } from "./grade";

// A hand's comfortable thumb-to-pinky reach in semitones, or null when unmeasured
// — people with one hand set only the hand they have. Personalizes the suggested
// fingering to the player's reach.
export type HandSpan = { left: number | null; right: number | null };

export type Prefs = {
    sound: boolean;
    volume: number; // 0..100
    masteryThreshold: Letter; // grade a score must reach to count as learned
    handSpan: HandSpan;
};

const KEY = "plinky:prefs";
const DEFAULTS: Prefs = {
    sound: true,
    volume: 80,
    masteryThreshold: "A",
    handSpan: { left: null, right: null },
};
const LETTERS: Letter[] = ["S", "A", "B", "C", "D"];

function clampVolume(value: number): number {
    return Math.max(0, Math.min(100, Math.round(value)));
}

// A reach below a fifth or beyond two octaves is taken as bad data and dropped to
// null, so a corrupt store can't feed nonsense into the fingering model.
function cleanSpan(value: unknown): number | null {
    return typeof value === "number" && value >= 5 && value <= 24 ? Math.round(value) : null;
}

function cleanHandSpan(value: unknown): HandSpan {
    const span = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
    return { left: cleanSpan(span.left), right: cleanSpan(span.right) };
}

export function loadPrefs(): Prefs {
    try {
        const parsed = JSON.parse(localStorage.getItem(KEY) ?? "{}");
        return {
            sound: typeof parsed.sound === "boolean" ? parsed.sound : DEFAULTS.sound,
            volume:
                typeof parsed.volume === "number" ? clampVolume(parsed.volume) : DEFAULTS.volume,
            masteryThreshold: LETTERS.includes(parsed.masteryThreshold)
                ? parsed.masteryThreshold
                : DEFAULTS.masteryThreshold,
            handSpan: cleanHandSpan(parsed.handSpan),
        };
    } catch {
        return { ...DEFAULTS, handSpan: { ...DEFAULTS.handSpan } };
    }
}

export function savePrefs(prefs: Prefs): void {
    try {
        localStorage.setItem(KEY, JSON.stringify({ ...prefs, volume: clampVolume(prefs.volume) }));
    } catch {
        // Preference persistence is best-effort.
    }
}

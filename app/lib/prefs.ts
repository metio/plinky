// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Letter } from "./grade";

export type Prefs = {
    sound: boolean;
    volume: number; // 0..100
    masteryThreshold: Letter; // grade a score must reach to count as learned
};

const KEY = "plinky:prefs";
const DEFAULTS: Prefs = { sound: true, volume: 80, masteryThreshold: "A" };
const LETTERS: Letter[] = ["S", "A", "B", "C", "D"];

function clampVolume(value: number): number {
    return Math.max(0, Math.min(100, Math.round(value)));
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
        };
    } catch {
        return { ...DEFAULTS };
    }
}

export function savePrefs(prefs: Prefs): void {
    try {
        localStorage.setItem(KEY, JSON.stringify({ ...prefs, volume: clampVolume(prefs.volume) }));
    } catch {
        // Preference persistence is best-effort.
    }
}

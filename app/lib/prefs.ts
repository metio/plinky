// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

export type Prefs = {
    sound: boolean;
    volume: number; // 0..100
};

const KEY = "plinky:prefs";
const DEFAULTS: Prefs = { sound: true, volume: 80 };

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

// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Which one-time coaching hints the player has already seen or dismissed, so each shows
// at most once. A plain per-device set under one key — cleared by the Settings reset.
const KEY = "plinky:seen-hints";

function load(): string[] {
    try {
        const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function hasSeenHint(id: string): boolean {
    return load().includes(id);
}

export function markHintSeen(id: string): void {
    try {
        const seen = new Set(load());
        seen.add(id);
        localStorage.setItem(KEY, JSON.stringify([...seen]));
    } catch {
        // Best-effort — a hint showing twice is harmless.
    }
}

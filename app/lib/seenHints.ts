// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Which one-time coaching hints the player has already seen or dismissed, so each shows
// at most once. A plain per-device set under one key — cleared by the Settings reset.

import { browserStore } from "../adapters/browserStore";
const KEY = "plinky:seen-hints";

function load(): string[] {
    try {
        const parsed = JSON.parse(browserStore.get(KEY) ?? "[]");
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
        browserStore.set(KEY, JSON.stringify([...seen]));
    } catch {
        // Best-effort — a hint showing twice is harmless.
    }
}

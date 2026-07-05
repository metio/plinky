// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Which one-time coaching hints the player has already seen or dismissed, so each shows
// at most once. A plain per-device set under one key — cleared by the Settings reset.

import { browserStore } from "../adapters/browserStore";
import { readJson, writeJson } from "../stores/jsonStore";
const KEY = "plinky:seen-hints";

function load(): string[] {
    const parsed = readJson(browserStore, KEY);
    return Array.isArray(parsed) ? parsed : [];
}

export function hasSeenHint(id: string): boolean {
    return load().includes(id);
}

export function markHintSeen(id: string): void {
    const seen = new Set(load());
    seen.add(id);
    writeJson(browserStore, KEY, [...seen]);
}

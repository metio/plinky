// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { isRecord } from "./guards";
import { jsonOf, NOT_JSON } from "./json";

// The Plinky progress-bundle format: every value this device holds — mastery,
// review schedule, lifetime fingerprint, takes, ghosts, fingerings, preferences,
// favourites, achievements and the score library — as one self-contained JSON
// document. Progress lives only in the browser, so this bundle is the only way it
// survives a new device, a cleared browser, or evicted storage.
//
// Values travel as their **raw stored strings** rather than re-parsed JSON. Every
// store already serializes its own shape, so keeping the string is lossless and
// unambiguous — re-parsing would make a stored JSON string (`"dark"`) and a bare
// string (`dark`) indistinguishable on the way back in.
//
// Keys travel **without the storage prefix**. Restoring re-adds it, so a bundle can
// only ever address Plinky's own keys — a hand-edited or hostile file has no way to
// name a key belonging to anything else on the origin.

export const PROGRESS_FORMAT = "plinky-progress";

export interface ProgressPack {
    format: typeof PROGRESS_FORMAT;
    version: 1;
    // When the bundle was written, ISO-8601. Shown on restore so a player can tell
    // two backups apart; never used to decide anything.
    savedAt: string;
    // Bare storage key -> the exact string stored under it.
    entries: Record<string, string>;
}

// Why a bundle could not be read. The caller maps these to translated copy — core
// never holds user-facing prose.
export type ProgressPackProblem = "json" | "format" | "empty";

export type ProgressParseResult =
    | { ok: true; pack: ProgressPack }
    | { ok: false; problem: ProgressPackProblem };

// Serialize a device's stored entries to a bundle. `savedAt` is passed in rather
// than read from a clock, so this stays pure and testable.
export function serializeProgress(entries: Record<string, string>, savedAt: string): string {
    const pack: ProgressPack = {
        format: PROGRESS_FORMAT,
        version: 1,
        savedAt,
        entries: pickStringEntries(entries),
    };
    return JSON.stringify(pack, null, 2);
}

// Parse and validate a bundle. Malformed individual entries are dropped rather than
// failing the whole restore — one unreadable value must not cost a player every
// other thing they had.
export function parseProgressPack(json: string): ProgressParseResult {
    const data = jsonOf(json);
    if (data === NOT_JSON) {
        return { ok: false, problem: "json" };
    }
    if (!isRecord(data) || data.format !== PROGRESS_FORMAT) {
        return { ok: false, problem: "format" };
    }
    if (!isRecord(data.entries)) {
        return { ok: false, problem: "format" };
    }
    const entries = pickStringEntries(data.entries);
    if (Object.keys(entries).length === 0) {
        return { ok: false, problem: "empty" };
    }
    return {
        ok: true,
        pack: {
            format: PROGRESS_FORMAT,
            version: 1,
            savedAt: typeof data.savedAt === "string" ? data.savedAt : "",
            entries,
        },
    };
}

// The string-valued entries under a non-empty key. An empty key would address the
// bare prefix on restore, and a non-string value cannot be a stored value, so both
// are dropped here — the one place entry shape is enforced for reading and writing
// alike, which keeps a bundle we wrote parseable by definition.
function pickStringEntries(source: Record<string, unknown>): Record<string, string> {
    // Built with fromEntries because it defines own data properties: a plain
    // `entries[key] = value` would reach the prototype for a key of "__proto__"
    // rather than storing it, so that entry would vanish from a backup while the
    // device still held it — and a hostile bundle would be assigning to a prototype.
    return Object.fromEntries(
        Object.entries(source).filter(
            (pair): pair is [string, string] => pair[0] !== "" && typeof pair[1] === "string",
        ),
    );
}

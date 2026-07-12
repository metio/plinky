// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { KeyValueStore } from "../ports/keyValueStore";
import { readScoreMeta, readScoreMetaFromText } from "../../core/scoreMeta";
import type { XmlCodec } from "../../core/xml";
import { readJson, writeJson } from "../stores/jsonStore";
import { parsePack, serializePack } from "../../core/scorePack";
import { songId } from "../../core/songId";
import { slugify } from "./slug";

// The one score catalogue: MusicXML pieces, rendered and practised on OSMD. The
// bundled public-domain scores ship with the app; user-imported pieces are kept in
// local storage and layer on top, a stored piece overriding a bundled one by id.
// The Score shape itself lives in core; re-exported here for the many callers
// that take the catalogue and its type from one import.
import type { Score } from "../../core/score";

export type { Score } from "../../core/score";

const files = import.meta.glob("../../scores/*.musicxml", {
    query: "?raw",
    import: "default",
    eager: true,
}) as Record<string, string>;

const STORAGE_KEY = "plinky:scores";

// Re-exported so importers that reach for the catalogue's slug keep working.
export { slugify };

// The demo pieces inlined into the bundle, identical for everyone. Finger exercises
// and the song catalogue load as on-demand assets instead, keeping the JS small.
export function loadBundledScores(): Score[] {
    return Object.entries(files).map(([_path, xml]) => {
        // Same content-fingerprint id scheme as every other piece. The bundled
        // MusicXML is our own generated output, so the pure text pass reads it —
        // no parser, which also keeps FIRST_SONG_ID's module-load derivation pure.
        return {
            id: songId(xml),
            ...readScoreMetaFromText(xml),
            description: "",
            xml,
            bundled: true,
        };
    });
}

// The bundled piece a true beginner starts on — a Grade 1 demo, resolved by title so links
// to it track its content-fingerprint id instead of a hard-coded filename.
export const FIRST_SONG_ID =
    loadBundledScores().find((score) => score.title.toLowerCase().includes("twinkle"))?.id ?? "";

// Coerce a stored entry into a usable Score, or drop it. A missing string title
// would otherwise throw in the catalogue's localeCompare sort and take down the
// whole list (home, scores, tracks, play); a non-finite tempo/beatsPerBar would
// poison the playback and grading math.
function normalizeUserScore(raw: unknown): Score | null {
    if (!raw || typeof raw !== "object") {
        return null;
    }
    const value = raw as Record<string, unknown>;
    if (
        typeof value.id !== "string" ||
        typeof value.title !== "string" ||
        typeof value.xml !== "string"
    ) {
        return null;
    }
    const positive = (field: unknown, fallback: number): number =>
        typeof field === "number" && Number.isFinite(field) && field > 0 ? field : fallback;
    return {
        id: value.id,
        title: value.title,
        xml: value.xml,
        composer: typeof value.composer === "string" ? value.composer : "",
        description: typeof value.description === "string" ? value.description : "",
        tempo: positive(value.tempo, 90),
        beatsPerBar: positive(value.beatsPerBar, 4),
        bundled: false,
        ...(typeof value.license === "string" ? { license: value.license } : {}),
    };
}

export function loadUserScores(kv: KeyValueStore): Score[] {
    const parsed = readJson(kv, STORAGE_KEY);
    if (!Array.isArray(parsed)) {
        return [];
    }
    return parsed.map(normalizeUserScore).filter((score): score is Score => score !== null);
}

function storeUserScores(kv: KeyValueStore, scores: Score[]): boolean {
    return writeJson(kv, STORAGE_KEY, scores);
}

// Returns false when the write fails (e.g. storage quota), so callers can tell
// the user rather than reporting a save that did not happen.
export function saveUserScore(kv: KeyValueStore, score: Score): boolean {
    return storeUserScores(kv, [
        ...loadUserScores(kv).filter((entry) => entry.id !== score.id),
        score,
    ]);
}

export function removeUserScore(kv: KeyValueStore, id: string): void {
    storeUserScores(
        kv,
        loadUserScores(kv).filter((entry) => entry.id !== id),
    );
}

// The whole catalogue: bundled scores plus the user's own, a stored piece shadowing
// a bundled one of the same id, sorted by title.
export function loadCatalog(kv: KeyValueStore): Score[] {
    const user = loadUserScores(kv);
    const userIds = new Set(user.map((score) => score.id));
    return [...loadBundledScores().filter((score) => !userIds.has(score.id)), ...user].sort(
        (a, b) => a.title.localeCompare(b.title),
    );
}

export function resolveScore(kv: KeyValueStore, id: string | undefined): Score | undefined {
    return id ? loadCatalog(kv).find((score) => score.id === id) : undefined;
}

// Derive a stored score from imported MusicXML, giving it an id unique in the
// catalogue so it neither clashes with nor silently overrides another piece.
export function buildScore(codec: XmlCodec, xml: string, takenIds: string[]): Score {
    const meta = readScoreMeta(codec, xml);
    const base = slugify(meta.title === "Untitled" ? "imported score" : meta.title);
    const taken = new Set(takenIds);
    let id = base;
    for (let n = 2; taken.has(id); n++) {
        id = `${base}-${n}`;
    }
    return { id, ...meta, description: "", xml, bundled: false };
}

// A backup of the user's library (their imported scores) as a bundle.
export function exportAllPack(kv: KeyValueStore): string {
    return serializePack(loadUserScores(kv));
}

// Everything held locally — the user's imports plus Plinky's bundled pieces — as
// one bundle, so the built-in songs can leave the device too. The deep song
// catalogue fetches on demand and isn't stored here, so it isn't included; each
// of those pieces exports individually from its play page.
export function exportFullPack(kv: KeyValueStore): string {
    return serializePack(loadCatalog(kv));
}

// Merge a bundle's scores into local storage, overwriting by id so a re-imported
// score refreshes. Throws if the bundle is invalid or won't store.
export function importScoresPack(
    kv: KeyValueStore,
    codec: XmlCodec,
    json: string,
): { imported: number } {
    const pack = parsePack(json);

    const scores = new Map(loadUserScores(kv).map((score) => [score.id, score]));
    for (const packScore of pack.scores) {
        const meta = readScoreMeta(codec, packScore.xml);
        scores.set(packScore.id, {
            id: packScore.id,
            title: packScore.title || meta.title,
            composer: meta.composer,
            description: packScore.description ?? "",
            xml: packScore.xml,
            tempo: packScore.tempo ?? meta.tempo,
            beatsPerBar: packScore.beatsPerBar ?? meta.beatsPerBar,
            bundled: false,
            ...(packScore.license ? { license: packScore.license } : {}),
        });
    }
    if (!storeUserScores(kv, [...scores.values()])) {
        throw new Error("Could not save the scores — they may exceed this device's storage.");
    }
    return { imported: pack.scores.length };
}

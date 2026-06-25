// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { type Curriculum, parsePack, serializePack } from "./scorePack";

// The one score catalogue: MusicXML pieces, rendered and practised on OSMD. The
// bundled public-domain scores ship with the app; user-imported pieces are kept in
// local storage and layer on top, a stored piece overriding a bundled one by id.
export type Score = {
    id: string;
    title: string;
    composer: string;
    description: string;
    xml: string;
    tempo: number; // beats per minute for the count-in and playback
    beatsPerBar: number;
    curriculums?: string[];
    license?: string;
    bundled: boolean; // true for the shipped scores, which cannot be removed
};

const files = import.meta.glob("../../scores/*.musicxml", {
    query: "?raw",
    import: "default",
    eager: true,
}) as Record<string, string>;

const STORAGE_KEY = "plinky:scores";
const CURRICULUMS_KEY = "plinky:curriculums";

type ScoreMeta = { title: string; composer: string; tempo: number; beatsPerBar: number };

const positiveOr = (value: number, fallback: number): number =>
    Number.isFinite(value) && value > 0 ? value : fallback;

// The static prerender runs in Node, where DOMParser is absent; it derives a play
// page's title from the bundled (well-formed, generated) MusicXML. A small regex
// pass covers the few fields needed there. The browser keeps the DOMParser path,
// which tolerates the messier MusicXML a user might import.
function readScoreMetaFromText(xml: string): ScoreMeta {
    const pick = (re: RegExp): string => xml.match(re)?.[1]?.trim() ?? "";
    const title =
        pick(/<work-title>([\s\S]*?)<\/work-title>/) ||
        pick(/<movement-title>([\s\S]*?)<\/movement-title>/) ||
        "Untitled";
    return {
        title,
        composer: pick(/<creator\b[^>]*type="composer"[^>]*>([\s\S]*?)<\/creator>/),
        tempo: Math.round(positiveOr(Number(pick(/<sound\b[^>]*\btempo="([^"]*)"/)), 90)),
        beatsPerBar: positiveOr(Number(pick(/<beats>([\s\S]*?)<\/beats>/)), 4),
    };
}

// Reads the metadata a score needs from its MusicXML.
export function readScoreMeta(xml: string): ScoreMeta {
    if (typeof DOMParser === "undefined") {
        return readScoreMetaFromText(xml);
    }
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const title =
        doc.querySelector("work-title")?.textContent?.trim() ||
        doc.querySelector("movement-title")?.textContent?.trim() ||
        "Untitled";
    const composer = doc.querySelector('creator[type="composer"]')?.textContent?.trim() || "";
    const beats = Number(doc.querySelector("time > beats")?.textContent);
    // A non-numeric tempo attribute (e.g. "andante") would otherwise feed NaN into
    // the 60000/tempo playback and grading math.
    const tempo = Number(doc.querySelector("sound[tempo]")?.getAttribute("tempo"));
    return {
        title,
        composer,
        tempo: Math.round(positiveOr(tempo, 90)),
        beatsPerBar: positiveOr(beats, 4),
    };
}

export function slugify(title: string): string {
    return (
        title
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || "score"
    );
}

// The shipped scores, identical for everyone — the pool the daily challenge draws
// from, regardless of what a device has imported.
export function loadBundledScores(): Score[] {
    return Object.entries(files).map(([path, xml]) => {
        const id = (path.split("/").pop() ?? path).replace(/\.musicxml$/, "");
        return { id, ...readScoreMeta(xml), description: "", xml, bundled: true };
    });
}

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
        ...(Array.isArray(value.curriculums)
            ? { curriculums: value.curriculums.filter((c): c is string => typeof c === "string") }
            : {}),
        ...(typeof value.license === "string" ? { license: value.license } : {}),
    };
}

export function loadUserScores(): Score[] {
    if (typeof localStorage === "undefined") {
        return [];
    }
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed.map(normalizeUserScore).filter((score): score is Score => score !== null);
    } catch {
        return [];
    }
}

function storeUserScores(scores: Score[]): boolean {
    if (typeof localStorage === "undefined") {
        return false;
    }
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
        return true;
    } catch {
        return false;
    }
}

// Returns false when the write fails (e.g. storage quota), so callers can tell
// the user rather than reporting a save that did not happen.
export function saveUserScore(score: Score): boolean {
    return storeUserScores([...loadUserScores().filter((entry) => entry.id !== score.id), score]);
}

export function removeUserScore(id: string): void {
    storeUserScores(loadUserScores().filter((entry) => entry.id !== id));
}

// The whole catalogue: bundled scores plus the user's own, a stored piece shadowing
// a bundled one of the same id, sorted by title.
export function loadCatalog(): Score[] {
    const user = loadUserScores();
    const userIds = new Set(user.map((score) => score.id));
    return [...loadBundledScores().filter((score) => !userIds.has(score.id)), ...user].sort(
        (a, b) => a.title.localeCompare(b.title),
    );
}

export function resolveScore(id: string | undefined): Score | undefined {
    return id ? loadCatalog().find((score) => score.id === id) : undefined;
}

// Derive a stored score from imported MusicXML, giving it an id unique in the
// catalogue so it neither clashes with nor silently overrides another piece.
export function buildScore(xml: string, takenIds: string[]): Score {
    const meta = readScoreMeta(xml);
    const base = slugify(meta.title === "Untitled" ? "imported score" : meta.title);
    const taken = new Set(takenIds);
    let id = base;
    for (let n = 2; taken.has(id); n++) {
        id = `${base}-${n}`;
    }
    return { id, ...meta, description: "", xml, bundled: false };
}

export function loadCurriculums(): Curriculum[] {
    if (typeof localStorage === "undefined") {
        return [];
    }
    try {
        const parsed = JSON.parse(localStorage.getItem(CURRICULUMS_KEY) ?? "[]");
        return Array.isArray(parsed) ? (parsed as Curriculum[]) : [];
    } catch {
        return [];
    }
}

function saveCurriculums(curriculums: Curriculum[]): void {
    if (typeof localStorage === "undefined") {
        return;
    }
    try {
        localStorage.setItem(CURRICULUMS_KEY, JSON.stringify(curriculums));
    } catch {
        // Best-effort, like the scores.
    }
}

const SUBMIT_ISSUE_URL = "https://github.com/metio/plinky/issues/new";

// A link that opens the prefilled "submit a score" issue form, so anyone can
// contribute using only their own GitHub account — no backend, no shared key.
export function submissionUrl(score?: Score): string {
    const params = new URLSearchParams({ template: "score-submission.yml" });
    if (score) {
        params.set("score-title", score.title);
        params.set("musicxml", score.xml);
        if (score.description) {
            params.set("description", score.description);
        }
        if (score.license) {
            params.set("license", score.license);
        }
    }
    return `${SUBMIT_ISSUE_URL}?${params.toString()}`;
}

// A backup of the user's library (their imported scores and curriculums) as a pack.
export function exportAllPack(): string {
    return serializePack(loadUserScores(), loadCurriculums());
}

// Merge a pack's curriculums and scores into local storage, overwriting by id so a
// re-imported curriculum refreshes. Throws if the pack is invalid or won't store.
export function importScoresPack(json: string): { imported: number; curriculums: number } {
    const pack = parsePack(json);

    const curriculums = new Map(loadCurriculums().map((entry) => [entry.id, entry]));
    for (const entry of pack.curriculums) {
        curriculums.set(entry.id, entry);
    }
    saveCurriculums([...curriculums.values()]);

    const scores = new Map(loadUserScores().map((score) => [score.id, score]));
    for (const packScore of pack.scores) {
        const meta = readScoreMeta(packScore.xml);
        scores.set(packScore.id, {
            id: packScore.id,
            title: packScore.title || meta.title,
            composer: meta.composer,
            description: packScore.description ?? "",
            xml: packScore.xml,
            tempo: packScore.tempo ?? meta.tempo,
            beatsPerBar: packScore.beatsPerBar ?? meta.beatsPerBar,
            bundled: false,
            ...(packScore.curriculums ? { curriculums: packScore.curriculums } : {}),
            ...(packScore.license ? { license: packScore.license } : {}),
        });
    }
    if (!storeUserScores([...scores.values()]) && typeof localStorage !== "undefined") {
        throw new Error("Could not save the scores — they may exceed this device's storage.");
    }
    return { imported: pack.scores.length, curriculums: pack.curriculums.length };
}

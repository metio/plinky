// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { type Curriculum, parsePack, serializePack } from "./songPack";

// The one song catalogue: MusicXML pieces, rendered and practised on OSMD. The
// bundled public-domain scores ship with the app; user-imported pieces are kept in
// local storage and layer on top, a stored piece overriding a bundled one by id.
export type Song = {
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

const STORAGE_KEY = "plinky:songs";
const CURRICULUMS_KEY = "plinky:curriculums";

// Reads the metadata a song needs from its MusicXML. DOMParser is browser-only, so
// callers run on the client (in an effect), as the catalogue already does.
export function readSongMeta(xml: string): {
    title: string;
    composer: string;
    tempo: number;
    beatsPerBar: number;
} {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const title =
        doc.querySelector("work-title")?.textContent?.trim() ||
        doc.querySelector("movement-title")?.textContent?.trim() ||
        "Untitled";
    const composer = doc.querySelector('creator[type="composer"]')?.textContent?.trim() || "";
    const beats = Number(doc.querySelector("time > beats")?.textContent);
    const soundTempo = doc.querySelector("sound[tempo]")?.getAttribute("tempo");
    return {
        title,
        composer,
        tempo: soundTempo ? Math.round(Number(soundTempo)) : 90,
        beatsPerBar: Number.isFinite(beats) && beats > 0 ? beats : 4,
    };
}

export function slugify(title: string): string {
    return (
        title
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || "song"
    );
}

// The shipped scores, identical for everyone — the pool the daily challenge draws
// from, regardless of what a device has imported.
export function loadBundledSongs(): Song[] {
    return Object.entries(files).map(([path, xml]) => {
        const id = (path.split("/").pop() ?? path).replace(/\.musicxml$/, "");
        return { id, ...readSongMeta(xml), description: "", xml, bundled: true };
    });
}

export function loadUserSongs(): Song[] {
    if (typeof localStorage === "undefined") {
        return [];
    }
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
        return Array.isArray(parsed) ? (parsed as Song[]) : [];
    } catch {
        return [];
    }
}

function storeUserSongs(songs: Song[]): boolean {
    if (typeof localStorage === "undefined") {
        return false;
    }
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
        return true;
    } catch {
        return false;
    }
}

export function saveUserSong(song: Song): void {
    storeUserSongs([...loadUserSongs().filter((entry) => entry.id !== song.id), song]);
}

export function removeUserSong(id: string): void {
    storeUserSongs(loadUserSongs().filter((entry) => entry.id !== id));
}

// The whole catalogue: bundled scores plus the user's own, a stored piece shadowing
// a bundled one of the same id, sorted by title.
export function loadCatalog(): Song[] {
    const user = loadUserSongs();
    const userIds = new Set(user.map((song) => song.id));
    return [...loadBundledSongs().filter((song) => !userIds.has(song.id)), ...user].sort((a, b) =>
        a.title.localeCompare(b.title),
    );
}

export function resolveSong(id: string | undefined): Song | undefined {
    return id ? loadCatalog().find((song) => song.id === id) : undefined;
}

// Derive a stored song from imported MusicXML, giving it an id unique in the
// catalogue so it neither clashes with nor silently overrides another piece.
export function buildSong(xml: string, takenIds: string[]): Song {
    const meta = readSongMeta(xml);
    const base = slugify(meta.title === "Untitled" ? "imported song" : meta.title);
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
        // Best-effort, like the songs.
    }
}

const SUBMIT_ISSUE_URL = "https://github.com/metio/plinky/issues/new";

// A link that opens the prefilled "submit a song" issue form, so anyone can
// contribute using only their own GitHub account — no backend, no shared key.
export function submissionUrl(song?: Song): string {
    const params = new URLSearchParams({ template: "song-submission.yml" });
    if (song) {
        params.set("song-title", song.title);
        params.set("musicxml", song.xml);
        if (song.description) {
            params.set("description", song.description);
        }
        if (song.license) {
            params.set("license", song.license);
        }
    }
    return `${SUBMIT_ISSUE_URL}?${params.toString()}`;
}

// A backup of the user's library (their imported songs and curriculums) as a pack.
export function exportAllPack(): string {
    return serializePack(loadUserSongs(), loadCurriculums());
}

// Merge a pack's curriculums and songs into local storage, overwriting by id so a
// re-imported curriculum refreshes. Throws if the pack is invalid or won't store.
export function importSongsPack(json: string): { imported: number; curriculums: number } {
    const pack = parsePack(json);

    const curriculums = new Map(loadCurriculums().map((entry) => [entry.id, entry]));
    for (const entry of pack.curriculums) {
        curriculums.set(entry.id, entry);
    }
    saveCurriculums([...curriculums.values()]);

    const songs = new Map(loadUserSongs().map((song) => [song.id, song]));
    for (const packSong of pack.songs) {
        const meta = readSongMeta(packSong.xml);
        songs.set(packSong.id, {
            id: packSong.id,
            title: packSong.title || meta.title,
            composer: meta.composer,
            description: packSong.description ?? "",
            xml: packSong.xml,
            tempo: packSong.tempo ?? meta.tempo,
            beatsPerBar: packSong.beatsPerBar ?? meta.beatsPerBar,
            bundled: false,
            ...(packSong.curriculums ? { curriculums: packSong.curriculums } : {}),
            ...(packSong.license ? { license: packSong.license } : {}),
        });
    }
    if (!storeUserSongs([...songs.values()]) && typeof localStorage !== "undefined") {
        throw new Error("Could not save the songs — they may exceed this device's storage.");
    }
    return { imported: pack.songs.length, curriculums: pack.curriculums.length };
}

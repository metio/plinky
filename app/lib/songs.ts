// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Score } from "./catalog";
import { loadFavorites, toggleFavorite } from "./favorites";
import { decompressMxl } from "./musicxmlFile";

// The curated PDMX song catalogue. Unlike the bundled exercises (inlined into the
// JS) and user imports (kept in localStorage), songs are too many to bundle: a
// small metadata manifest is shipped for browsing, and each song's compressed
// MusicXML is fetched on demand from /songs/<id>.mxl (service-worker cached for
// offline). The build emits both via dev/import-pdmx.mts.

export type SongMeta = {
    id: string;
    title: string;
    composer: string;
    grade: number;
    license: string;
    tempo: number;
    beatsPerBar: number;
    bars: number;
};

const MANIFEST_URL = "/songs/manifest.json";
const SEED_URL = "/songs/seed.json";
const SEEDED_KEY = "plinky:songs-seeded";

let manifestCache: SongMeta[] | null = null;

// The browsable catalogue (metadata only). Cached for the session; returns [] when
// the manifest is absent (e.g., a dev build without an import run) so the rest of
// the app degrades quietly.
export async function loadManifest(): Promise<SongMeta[]> {
    if (manifestCache) {
        return manifestCache;
    }
    try {
        const response = await fetch(MANIFEST_URL);
        manifestCache = response.ok ? ((await response.json()) as SongMeta[]) : [];
    } catch {
        manifestCache = [];
    }
    return manifestCache;
}

// Songs are stored as compressed .mxl (a zip holding the MusicXML), so the fetched
// bytes are decompressed to the XML string OSMD loads.
export async function fetchSongXml(id: string): Promise<string | null> {
    try {
        const response = await fetch(`/songs/${id}.mxl`);
        if (!response.ok) {
            return null;
        }
        return decompressMxl(new Uint8Array(await response.arrayBuffer()));
    } catch {
        return null;
    }
}

// Resolve a song id to a playable Score by fetching its MusicXML; null if unknown
// or unfetchable. The play flow falls back to this when an id isn't a bundled or
// user score.
export async function resolveSong(id: string): Promise<Score | null> {
    const meta = (await loadManifest()).find((song) => song.id === id);
    if (!meta) {
        return null;
    }
    const xml = await fetchSongXml(id);
    if (xml === null) {
        return null;
    }
    return {
        id: meta.id,
        title: meta.title,
        composer: meta.composer,
        description: "",
        xml,
        tempo: meta.tempo,
        beatsPerBar: meta.beatsPerBar,
        license: meta.license,
        bundled: false,
    };
}

// On first run, star the seed songs (a few per grade) so the library spans grades
// 1–8 and the home page has something to show without the player hunting first.
// Guarded so it runs once.
export async function ensureSeeded(): Promise<void> {
    if (typeof localStorage === "undefined" || localStorage.getItem(SEEDED_KEY)) {
        return;
    }
    try {
        const response = await fetch(SEED_URL);
        const seed = response.ok ? ((await response.json()) as string[]) : [];
        const starred = loadFavorites();
        for (const id of seed) {
            if (!starred.has(id)) {
                toggleFavorite(id);
            }
        }
        localStorage.setItem(SEEDED_KEY, "1");
    } catch {
        // No seed shipped (dev build) — nothing to add.
    }
}

// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { DEFAULT_SONG_SOURCE, licenseDir } from "../../core/attribution";
import { decompressMxl } from "../../core/musicxmlFile";
import type { Score } from "../lib/catalog";
import { loadFavorites, toggleFavorite } from "../lib/favorites";
import type { Fetcher } from "../ports/fetcher";
import type { KeyValueStore } from "../ports/keyValueStore";

// The curated song catalogue. Unlike the bundled exercises (inlined into the
// JS) and user imports (kept in the browser store), songs are too many to
// bundle: a small metadata manifest is shipped for browsing, and each song's
// compressed MusicXML is fetched on demand from /songs/<id>.mxl
// (service-worker cached for offline). The build emits both via
// dev/import-pdmx.mts. Built over the network and storage seams, so a test
// hands in a lambda fetcher and a memory store.

export type SongMeta = {
    id: string;
    title: string;
    composer: string;
    grade: number;
    // The raw fingering-cost the grade was binned from; lets a grade's songs be
    // ordered easiest-first and a syllabus draw the gentlest of a grade.
    cost: number;
    license: string;
    // Where the piece was sourced from; defaults to PDMX (the whole shipped
    // catalogue) when a manifest entry omits it.
    source?: string;
    tempo: number;
    beatsPerBar: number;
    bars: number;
};

const MANIFEST_URL = "/songs/manifest.json";
const SEED_URL = "/songs/seed.json";
const SEEDED_KEY = "plinky:songs-seeded";
const PROBE_KEY = "plinky:songs-seeded-probe";

export type SongSource = {
    // The browsable catalogue (metadata only). Cached for the session; [] when
    // the manifest is absent (e.g., a dev build without an import run) so the
    // rest of the app degrades quietly.
    manifest(): Promise<SongMeta[]>;
    // A song's MusicXML, decompressed from its .mxl; null when unknown or
    // unfetchable.
    fetchXml(id: string, license?: string): Promise<string | null>;
    // A song id as a playable Score; null if unknown, so the play flow can fall
    // through to bundled, user or exercise scores.
    resolve(id: string): Promise<Score | null>;
    // On first run, star the seed songs (a few per grade) so the library spans
    // grades 1–8 and the home page has something to show without hunting.
    ensureSeeded(): Promise<void>;
};

export function createSongSource(fetchUrl: Fetcher, kv: KeyValueStore): SongSource {
    let manifestCache: SongMeta[] | null = null;

    const manifest = async (): Promise<SongMeta[]> => {
        if (manifestCache) {
            return manifestCache;
        }
        try {
            const response = await fetchUrl(MANIFEST_URL);
            manifestCache = response.ok ? ((await response.json()) as SongMeta[]) : [];
        } catch {
            manifestCache = [];
        }
        return manifestCache;
    };

    const fetchXml = async (id: string, license?: string): Promise<string | null> => {
        try {
            const response = await fetchUrl(`/songs/${licenseDir(license)}/${id}.mxl`);
            if (!response.ok) {
                return null;
            }
            return decompressMxl(new Uint8Array(await response.arrayBuffer()));
        } catch {
            return null;
        }
    };

    return {
        manifest,
        fetchXml,
        async resolve(id) {
            const meta = (await manifest()).find((song) => song.id === id);
            if (!meta) {
                return null;
            }
            const xml = await fetchXml(id, meta.license);
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
                source: meta.source ?? DEFAULT_SONG_SOURCE,
                bundled: false,
            };
        },
        // Guarded so it runs once. The flag is written only after a successful
        // seeding, so a first visit that cannot reach the seed (offline install)
        // retries next load.
        async ensureSeeded() {
            if (kv.get(SEEDED_KEY)) {
                return;
            }
            // Blocked storage would make the favorites unwritable AND the flag
            // unlatchable, repeating the fetch on every page load — probe before
            // doing any network work.
            if (!kv.set(PROBE_KEY, "1")) {
                return;
            }
            kv.remove(PROBE_KEY);
            try {
                const response = await fetchUrl(SEED_URL);
                const seed = response.ok ? ((await response.json()) as string[]) : [];
                const starred = loadFavorites();
                for (const id of seed) {
                    if (!starred.has(id)) {
                        toggleFavorite(id);
                    }
                }
                kv.set(SEEDED_KEY, "1");
            } catch {
                // No seed shipped (dev build) — nothing to add.
            }
        },
    };
}

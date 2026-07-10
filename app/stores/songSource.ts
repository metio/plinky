// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { DEFAULT_SONG_SOURCE, licenseDir } from "../../core/attribution";
import type { Fetcher } from "../ports/fetcher";
import type { KeyValueStore } from "../ports/keyValueStore";
import type { FavoritesStore } from "./favoritesStore";
import { cachedManifest, fetchMxlXml, type ResolvedScore } from "./manifest";

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
    // The browsable catalogue (metadata only). A completed fetch is cached for
    // the session; a failed or absent manifest (offline moment, a dev build
    // without an import run) answers null for that call only, so the app can
    // degrade quietly now and recover on the next ask. Null keeps "unreachable"
    // distinguishable from "empty catalogue" — display-only callers may treat
    // null as empty, but missing-ness checks must not.
    manifest(): Promise<SongMeta[] | null>;
    // A song's MusicXML, decompressed from its .mxl; null when unknown or
    // unfetchable.
    fetchXml(id: string, license?: string): Promise<string | null>;
    // A song id as a playable Score; null if unknown, so the play flow can fall
    // through to bundled, user or exercise scores; "unavailable" when a fetch
    // failed and the answer is simply unknown.
    resolve(id: string): Promise<ResolvedScore>;
    // On first run, star the seed songs (a few per grade) so the library spans
    // grades 1–8 and the home page has something to show without hunting.
    ensureSeeded(): Promise<void>;
};

// Seeding writes through the same favorites store the UI subscribes to, so the
// injected persistence is honored end to end — overriding `store` in the
// provider redirects the seed writes along with everything else.
export function createSongSource(
    fetchUrl: Fetcher,
    kv: KeyValueStore,
    favorites: FavoritesStore,
): SongSource {
    const manifest = cachedManifest<SongMeta>(fetchUrl, MANIFEST_URL);

    const fetchXml = (id: string, license?: string): Promise<string | null> =>
        fetchMxlXml(fetchUrl, `/songs/${licenseDir(license)}/${id}.mxl`);

    return {
        manifest,
        fetchXml,
        async resolve(id) {
            const list = await manifest();
            if (list === null) {
                return "unavailable";
            }
            const meta = list.find((song) => song.id === id);
            if (!meta) {
                return null;
            }
            const xml = await fetchXml(id, meta.license);
            if (xml === null) {
                // The manifest names this song, so the piece exists — only its
                // .mxl could not be fetched right now.
                return "unavailable";
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
                for (const id of seed) {
                    if (!favorites.has(id)) {
                        favorites.toggle(id);
                    }
                }
                kv.set(SEEDED_KEY, "1");
            } catch {
                // No seed shipped (dev build) — nothing to add.
            }
        },
    };
}

// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { DEFAULT_SONG_SOURCE, licenseDir } from "../../core/attribution";
import type { Fetcher } from "../ports/fetcher";
import { shardName } from "../../core/catalogShard";
import { cachedManifest, fetchMxlXml, type ResolvedScore } from "./manifest";
import type { BuiltinAssignment, SongMeta } from "../../core/catalogMeta";

// The curated song catalogue. Unlike the bundled exercises (inlined into the
// JS) and user imports (kept in the browser store), songs are too many to
// bundle: a small metadata manifest is shipped for browsing, and each song's
// compressed MusicXML is fetched on demand from /songs/<id>.mxl
// (service-worker cached for offline). The build emits both via
// dev/import-pdmx.mts. Built over the network and storage seams, so a test
// hands in a lambda fetcher and a memory store.

export type { BuiltinAssignment, SongMeta };

const MANIFEST_URL = "/songs/manifest.json";
const BUILTIN_ASSIGNMENTS_URL = "/songs/builtin-assignments.json";
// Where the per-piece slices of that manifest live, written by `npm run songs:bake`.
const SLICE_DIR = "/songs/index";

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
    // The named works, or null when they could not be fetched — read like the manifest,
    // and treated as nothing to offer rather than as an error a player should see.
    builtins(): Promise<BuiltinAssignment[] | null>;
};

export function createSongSource(fetchUrl: Fetcher): SongSource {
    const manifest = cachedManifest<SongMeta>(fetchUrl, MANIFEST_URL);
    // One piece's row, from the slice of the catalogue its id falls in — about ten
    // kilobytes rather than the six hundred the whole manifest costs. This is what a
    // piece's page waits on before it can engrave a note, and it used to wait on the entire
    // catalogue to read one row of it.
    //
    // The full manifest is the fallback, not the path: a slice that cannot be fetched
    // leaves the question genuinely unanswered, and a deploy mid-session can leave a cached
    // page asking for a slice that has moved. Falling back keeps a real piece from ever
    // reading as nonexistent — the distinction ResolvedScore exists to make.
    //
    // One memoised getter per slice, kept for the session like the manifest's own: a
    // getter made per call would forget its slice as soon as it answered, and a piece
    // opened twice would fetch its slice twice. At most one entry per shard.
    const slices = new Map<string, () => Promise<SongMeta[] | null>>();
    const sliceFor = (name: string) => {
        let get = slices.get(name);
        if (!get) {
            get = cachedManifest<SongMeta>(fetchUrl, `${SLICE_DIR}/${name}.json`);
            slices.set(name, get);
        }
        return get;
    };
    const metaFor = async (id: string): Promise<SongMeta | null | "unavailable"> => {
        const slice = await sliceFor(shardName(id))();
        if (slice !== null) {
            return slice.find((song) => song.id === id) ?? null;
        }
        const list = await manifest();
        return list === null ? "unavailable" : (list.find((song) => song.id === id) ?? null);
    };

    const fetchXml = (id: string, license?: string): Promise<string | null> =>
        fetchMxlXml(fetchUrl, `/songs/${licenseDir(license)}/${id}.mxl`);

    const builtins = cachedManifest<BuiltinAssignment>(fetchUrl, BUILTIN_ASSIGNMENTS_URL);

    return {
        manifest,
        builtins,
        fetchXml,
        async resolve(id) {
            const meta = await metaFor(id);
            if (meta === "unavailable") {
                return "unavailable";
            }
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
                credit: meta.credit,
                bundled: false,
            };
        },
    };
}

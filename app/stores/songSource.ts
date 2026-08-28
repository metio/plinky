// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { DEFAULT_SONG_SOURCE, licenseDir } from "../../core/attribution";
import type { Fetcher } from "../ports/fetcher";
import { shardName } from "../../core/catalogShard";
import type { ScoreKind } from "../../core/scoreKind";
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
    credit?: string;
    tempo: number;
    beatsPerBar: number;
    // How many bars the piece runs to. The app reads it nowhere — it is the catalogue
    // pipeline's own tie-break when two transcriptions of one work collapse into one row
    // (dev/dedup-songs prefers the shorter), and the manifest is where that lives. Kept
    // deliberately, so an audit that spots "written, never read" finds the reason here.
    bars: number;
    // The piece's opening bars, baked by dev/bake-incipits so a list can draw the mark
    // that names a piece without fetching its notation. Absent on a piece whose opening
    // would not read, and on any manifest written before it was baked.
    incipit?: string;
    // What the piece is written for (core/scoreKind). Two thirds of the catalogue is a
    // song with a piano part or a choral setting reduced to a grand staff; both are
    // playable and neither is what a grade ladder should offer a beginner, so this is what
    // lets the ladder ask for piano writing while the library keeps everything.
    scoreKind?: ScoreKind;
};

// A named work the catalogue holds enough of to work through as one thing — an opus, a
// book of studies, a suite — resolved to its piece ids by `npm run songs:bake`. The app
// turns each into a built-in assignment, so a set is nothing a player has to learn about:
// it is an assignment that was already there.
export type BuiltinAssignment = {
    id: string;
    // A composer and a work. A proper noun, so it is catalogue data rather than a
    // translated string.
    name: string;
    // The pieces, gentlest first, so working through a set is working up through it.
    items: string[];
};

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
    const metaFor = async (id: string): Promise<SongMeta | null | "unavailable"> => {
        const slice = await cachedManifest<SongMeta>(
            fetchUrl,
            `${SLICE_DIR}/${shardName(id)}.json`,
        )();
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

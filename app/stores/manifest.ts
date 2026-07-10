// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { decompressMxl } from "../../core/musicxmlFile";
import type { Score } from "../../core/score";
import type { Fetcher } from "../ports/fetcher";

// The outcome of resolving a catalogue id: the Score, null when a loaded
// catalogue has no such piece, or "unavailable" when the network kept the
// question from being answered — a real piece must never read as nonexistent
// just because a fetch failed.
export type ResolvedScore = Score | "unavailable" | null;

// Fetch a catalogue manifest: a JSON array whose entries carry a string id.
// Returns the validated entries for a completed fetch, or null for anything
// that should NOT be remembered — a network failure, a non-OK response, or a
// body that isn't an array (a captive portal's HTML, a misconfigured server).
// The caller caches only a non-null result, so a transient failure never
// empties a catalogue for the rest of the session.
export async function fetchManifest<T extends { id: string }>(
    fetchUrl: Fetcher,
    url: string,
): Promise<T[] | null> {
    try {
        const response = await fetchUrl(url);
        if (!response.ok) {
            return null;
        }
        const parsed: unknown = await response.json();
        if (!Array.isArray(parsed)) {
            return null;
        }
        // Entries without a usable id can't be resolved or rendered; dropping
        // them here keeps one junk row from breaking every consumer of the list.
        return parsed.filter(
            (entry): entry is T =>
                typeof entry === "object" &&
                entry !== null &&
                typeof (entry as { id?: unknown }).id === "string",
        );
    } catch {
        return null;
    }
}

// The manifest fetch as a memoized getter: concurrent first-render callers share
// one request rather than each firing the fetch. Only a completed fetch is cached
// for the session; a failure answers null for that call only and clears the
// in-flight promise, so the next call tries the network again. The null is part
// of the contract: "the catalogue is empty" and "the catalogue is unreachable"
// must stay distinguishable, or an offline moment would read as every fetched
// piece having vanished.
export function cachedManifest<T extends { id: string }>(
    fetchUrl: Fetcher,
    url: string,
): () => Promise<T[] | null> {
    let cache: T[] | null = null;
    let inFlight: Promise<T[] | null> | null = null;
    return () => {
        if (cache) {
            return Promise.resolve(cache);
        }
        if (!inFlight) {
            inFlight = fetchManifest<T>(fetchUrl, url).then((fetched) => {
                inFlight = null;
                if (fetched) {
                    cache = fetched;
                }
                return fetched;
            });
        }
        return inFlight;
    };
}

// A catalogue piece's MusicXML, decompressed from the .mxl at `url`; null when
// the fetch fails or the server has no such piece, so the caller can fall
// through instead of throwing into the play flow.
export async function fetchMxlXml(fetchUrl: Fetcher, url: string): Promise<string | null> {
    try {
        const response = await fetchUrl(url);
        if (!response.ok) {
            return null;
        }
        return decompressMxl(new Uint8Array(await response.arrayBuffer()));
    } catch {
        return null;
    }
}

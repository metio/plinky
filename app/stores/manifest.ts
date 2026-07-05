// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Fetcher } from "../ports/fetcher";

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

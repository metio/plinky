// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Fetcher } from "../ports/fetcher";

// The plumbing shared by every Sanity-backed content source (news, help): the
// project coordinates from build-time env, the public query-API URL, and the
// defensive fetch. Each source keeps only its own GROQ query and result parsing.

export type SanityConfig = {
    projectId: string;
    dataset: string;
    // Sanity API version, `YYYY-MM-DD` (without the leading `v`).
    apiVersion: string;
    // The GROQ query returning a result already shaped for the source's parser.
    query: string;
};

// The shared project coordinates from build-time env, or null when the project
// isn't wired yet — in which case a source stays silent and never touches the
// network. Vite inlines `VITE_`-prefixed vars at build; unset means no content.
export function sanityProjectFromEnv(): Omit<SanityConfig, "query"> | null {
    const projectId = import.meta.env?.VITE_SANITY_PROJECT_ID as string | undefined;
    const dataset = import.meta.env?.VITE_SANITY_DATASET as string | undefined;
    if (!projectId || !dataset) {
        return null;
    }
    return {
        projectId,
        dataset,
        apiVersion:
            (import.meta.env?.VITE_SANITY_API_VERSION as string | undefined) || "2024-01-01",
    };
}

// The query-API URL on the `apicdn` host — the cached, read-optimized endpoint
// meant for public client reads; CORS is open for a public dataset. GROQ
// parameters ride the query string as `$name=<json>`.
export function sanityQueryUrl(config: SanityConfig, params: Record<string, unknown> = {}): string {
    let query = `?query=${encodeURIComponent(config.query)}`;
    for (const [name, value] of Object.entries(params)) {
        query += `&$${name}=${encodeURIComponent(JSON.stringify(value))}`;
    }
    return (
        `https://${config.projectId}.apicdn.sanity.io/v${config.apiVersion}` +
        `/data/query/${config.dataset}${query}`
    );
}

// Runs the query and hands back the raw `result`, or null for any failure — a
// network error, a non-OK response, or a non-JSON body — never a thrown error
// into the render. Bypasses the browser HTTP cache: the content changes in
// Studio without a redeploy, so a cached copy must never outlive a publish;
// Sanity's apicdn is purged on publish, so the network read is fresh.
export async function fetchSanityResult(fetchUrl: Fetcher, url: string): Promise<unknown> {
    try {
        const response = await fetchUrl(url, { cache: "no-store" });
        if (!response.ok) {
            return null;
        }
        const body: unknown = await response.json();
        return (body as { result?: unknown } | null)?.result ?? null;
    } catch {
        return null;
    }
}

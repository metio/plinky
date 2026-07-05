// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { type NewsItem, parseNews } from "../../core/news";
import type { Fetcher } from "../ports/fetcher";
import type { NewsSource } from "../ports/news";

// Reads the active news item from a Sanity project's public query API. The editor
// publishes a picture + link in Sanity Studio; the live app fetches it here — no
// git, no redeploy. Uses the injected network seam, so a test drives it with a
// canned Response instead of the real CDN.
//
// The expected Sanity document (type "news"): an image field `image`, an `alt`
// string, a `link` URL, an optional `headline`, and a boolean `show`. The default
// query returns the most recently updated shown one, projecting the asset to a
// direct https CDN URL.

export type SanityConfig = {
    projectId: string;
    dataset: string;
    // Sanity API version, `YYYY-MM-DD` (without the leading `v`).
    apiVersion: string;
    // The GROQ query returning one news document already shaped to the loose
    // fields parseNews expects.
    query: string;
};

const DEFAULT_QUERY =
    '*[_type == "news" && show == true] | order(_updatedAt desc)[0]{' +
    '"id": _id, "imageUrl": image.asset->url, "imageAlt": coalesce(alt, ""), ' +
    '"linkUrl": link, headline, aspect}';

// The Sanity config from build-time env, or null when the project isn't wired
// yet — in which case the source stays silent and never touches the network.
// Vite inlines `VITE_`-prefixed vars at build; unset means no news.
export function sanityConfigFromEnv(): SanityConfig | null {
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
        query: (import.meta.env?.VITE_SANITY_QUERY as string | undefined) || DEFAULT_QUERY,
    };
}

function queryUrl(config: SanityConfig): string {
    // The `apicdn` host is the cached, read-optimized endpoint meant for public
    // client reads; CORS is open for a public dataset.
    return (
        `https://${config.projectId}.apicdn.sanity.io/v${config.apiVersion}` +
        `/data/query/${config.dataset}?query=${encodeURIComponent(config.query)}`
    );
}

export function createSanityNews(
    fetchUrl: Fetcher,
    config: SanityConfig | null = sanityConfigFromEnv(),
): NewsSource {
    return {
        async fetchActive(): Promise<NewsItem | null> {
            if (!config) {
                return null;
            }
            try {
                const response = await fetchUrl(queryUrl(config));
                if (!response.ok) {
                    return null;
                }
                const body: unknown = await response.json();
                const result = (body as { result?: unknown } | null)?.result;
                return parseNews(result);
            } catch {
                // A network failure, a non-JSON body, or a malformed result all
                // mean no news — never a thrown error into the render.
                return null;
            }
        },
    };
}

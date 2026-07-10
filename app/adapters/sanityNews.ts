// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { type NewsItem, parseNews } from "../../core/news";
import type { Fetcher } from "../ports/fetcher";
import type { NewsSource } from "../ports/news";
import {
    fetchSanityResult,
    type SanityConfig,
    sanityProjectFromEnv,
    sanityQueryUrl,
} from "./sanity";

// Reads the active news item from a Sanity project's public query API. The editor
// publishes a picture + link in Sanity Studio; the live app fetches it here — no
// git, no redeploy. Uses the injected network seam, so a test drives it with a
// canned Response instead of the real CDN.
//
// The expected Sanity content: a singleton `siteSettings` document with a
// `newsEnabled` boolean (the master switch for the whole board), and `news`
// documents each with an image field `image`, an `alt` string, a `link` URL, an
// optional `headline`, and a boolean `show`. The default query returns the
// most-recently-updated shown item together with the master switch, projecting
// the image asset to a direct https CDN URL. News is hidden when the switch is
// explicitly off, so the board works with just a shown item and no settings doc.

export type { SanityConfig };

const DEFAULT_QUERY =
    '{"enabled": *[_type == "siteSettings"][0].newsEnabled, ' +
    '"item": *[_type == "news" && show == true] | order(_updatedAt desc)[0]{' +
    '"id": _id, "imageUrl": image.asset->url, "imageAlt": coalesce(alt, ""), ' +
    '"linkUrl": link, headline, aspect}}';

// The Sanity config from build-time env, or null when the project isn't wired
// yet — in which case the source stays silent and never touches the network.
export function sanityConfigFromEnv(): SanityConfig | null {
    const project = sanityProjectFromEnv();
    if (!project) {
        return null;
    }
    return {
        ...project,
        query: (import.meta.env?.VITE_SANITY_QUERY as string | undefined) || DEFAULT_QUERY,
    };
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
            const result = await fetchSanityResult(fetchUrl, sanityQueryUrl(config));
            if (typeof result !== "object" || result === null) {
                return null;
            }
            const { enabled, item } = result as { enabled?: unknown; item?: unknown };
            // The siteSettings master switch: the board is hidden only when
            // `newsEnabled` is explicitly false, so it works with just a shown
            // item even before any settings document exists.
            if (enabled === false) {
                return null;
            }
            return parseNews(item);
        },
    };
}

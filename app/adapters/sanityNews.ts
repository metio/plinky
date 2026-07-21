// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { type NewsItem, parseNewsList } from "../../core/news";
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
// optional `headline`, and a boolean `show`. The default query returns the most-
// recently-updated shown items (newest first, capped) together with the master
// switch, projecting each image asset to a direct https CDN URL alongside the
// image's Studio `crop` and the asset's original `dimensions`, so an editor's crop
// is baked into the served URL (croppedImageUrl) rather than ignored. News is
// hidden when the switch is explicitly off, so the board works with just a shown
// item and no settings doc.

export type { SanityConfig };

// The banner rotates through at most this many items; the query slices to it so
// the network only ever carries the handful the UI can show.
const MAX_ITEMS = 3;

const DEFAULT_QUERY =
    '{"enabled": *[_type == "siteSettings"][0].newsEnabled, ' +
    `"items": *[_type == "news" && show == true] | order(_updatedAt desc)[0...${MAX_ITEMS}]{` +
    '"id": _id, "imageUrl": image.asset->url, "crop": image.crop, ' +
    '"dimensions": image.asset->metadata.dimensions, "imageAlt": coalesce(alt, ""), ' +
    '"linkUrl": link, headline}}';

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
        async fetchActive(): Promise<NewsItem[]> {
            if (!config) {
                return [];
            }
            const result = await fetchSanityResult(fetchUrl, sanityQueryUrl(config));
            if (typeof result !== "object" || result === null) {
                return [];
            }
            const { enabled, items } = result as { enabled?: unknown; items?: unknown };
            // The siteSettings master switch: the board is hidden only when
            // `newsEnabled` is explicitly false, so it works with just a shown
            // item even before any settings document exists.
            if (enabled === false) {
                return [];
            }
            return parseNewsList(items, MAX_ITEMS);
        },
    };
}

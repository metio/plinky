// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Release } from "../../core/changelog";
import type { Fetcher } from "../ports/fetcher";

// The whole changelog, fetched once.
//
// The /news page's document carries the newest releases already; this is the archive
// behind them, written beside the site by dev/gen-news-feed.mts. Fetched rather than
// bundled because it is a hundred and sixty kilobytes and grows with every deploy, and
// bundled it would be paid for by every visitor to every page.

const FEED_URL = "/news.json";

export type NewsSource = {
    // Every release, newest first — or null when the file could not be read. Null is
    // "unreachable", not "there is no news": the page then keeps the releases it shipped
    // with rather than replacing them with an empty list.
    releases(): Promise<Release[] | null>;
};

const looksLikeRelease = (value: unknown): boolean =>
    typeof value === "object" &&
    value !== null &&
    typeof (value as { date?: unknown }).date === "string" &&
    Array.isArray((value as { entries?: unknown }).entries);

export function createNewsSource(fetchUrl: Fetcher): NewsSource {
    let pending: Promise<Release[] | null> | null = null;
    return {
        releases() {
            pending ??= fetchUrl(FEED_URL)
                .then((response) => (response.ok ? response.json() : null))
                .then((value: unknown) =>
                    Array.isArray(value) && value.every(looksLikeRelease)
                        ? (value as Release[])
                        : null,
                )
                .catch(() => null);
            return pending;
        },
    };
}

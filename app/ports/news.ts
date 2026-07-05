// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { NewsItem } from "../../core/news";

// The seam for the home-page news item: fetch whatever is currently published,
// or null when nothing is live, the source isn't configured, or the fetch fails.
// A function-shaped capability with one call — the Sanity adapter implements it
// in production, an in-memory fake backs tests and local preview.
export type NewsSource = {
    fetchActive(): Promise<NewsItem | null>;
};

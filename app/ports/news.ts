// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { NewsItem } from "../../core/news";

// The seam for the home-page news: fetch the items currently published, newest
// first, or an empty list when nothing is live, the source isn't configured, or
// the fetch fails. A small bounded set — the banner rotates through it — so the
// list is never large. The Sanity adapter implements it in production, an
// in-memory fake backs tests and local preview.
export type NewsSource = {
    fetchActive(): Promise<NewsItem[]>;
};

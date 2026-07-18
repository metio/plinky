// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { NewsItem } from "../../core/news";
import type { NewsSource } from "../ports/news";

// An in-memory NewsSource that resolves to a fixed list, or to nothing by
// default. Accepts a single item, a list, or null for ergonomics — a lone item is
// wrapped, null becomes an empty list. Production wires the Sanity adapter; this
// backs component tests (inject it through the services provider) and local
// preview where no content service should be reached.
export function fakeNews(items: NewsItem | readonly NewsItem[] | null = null): NewsSource {
    const list = items == null ? [] : Array.isArray(items) ? [...items] : [items as NewsItem];
    return { fetchActive: async () => list };
}

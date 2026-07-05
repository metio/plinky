// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { NewsItem } from "../../core/news";
import type { NewsSource } from "../ports/news";

// An in-memory NewsSource that resolves to a fixed item, or to nothing by
// default. Production wires the Sanity adapter; this backs component tests (inject
// it through the services provider) and local preview where no content service
// should be reached.
export function fakeNews(item: NewsItem | null = null): NewsSource {
    return { fetchActive: async () => item };
}

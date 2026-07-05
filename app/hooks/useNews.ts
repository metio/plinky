// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import type { NewsItem } from "../../core/news";
import { useNewsSource } from "../contexts/services";

// Fetch the active news item once on mount. Null until it resolves, and null on
// any failure, so the banner simply doesn't render — news never blocks or breaks
// the page. Client-only: the source is not reached during prerender, keeping the
// static shell (and its layout) stable.
export function useNews(): NewsItem | null {
    const source = useNewsSource();
    const [item, setItem] = useState<NewsItem | null>(null);
    useEffect(() => {
        let live = true;
        source.fetchActive().then(
            (next) => {
                if (live) {
                    setItem(next);
                }
            },
            () => {},
        );
        return () => {
            live = false;
        };
    }, [source]);
    return item;
}

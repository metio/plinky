// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import type { NewsItem } from "../../core/news";
import { useNewsSource } from "../contexts/services";

// Fetch the active news items once on mount. Empty until it resolves, and empty
// on any failure, so the banner simply doesn't render — news never blocks or
// breaks the page. Client-only: the source is not reached during prerender,
// keeping the static shell (and its layout) stable.
export function useNews(): NewsItem[] {
    const source = useNewsSource();
    const [items, setItems] = useState<NewsItem[]>([]);
    useEffect(() => {
        let live = true;
        source.fetchActive().then(
            (next) => {
                if (live) {
                    setItems(next);
                }
            },
            () => {},
        );
        return () => {
            live = false;
        };
    }, [source]);
    return items;
}

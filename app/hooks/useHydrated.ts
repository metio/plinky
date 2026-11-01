// SPDX-FileCopyrightText: The Klimpi Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useState } from "react";

// Whether the app is running rather than being hydrated: false while the server writes
// the page and through the first client render, true from the render after it.
//
// For the one thing a prerendered page cannot know — what is in the address. Every page
// ships as a static document, and one document answers every query string, so it is
// written as though there were none. A first client render that reads the query therefore
// disagrees with the document it is hydrating, and React answers a mismatch by throwing
// the server's markup away and rendering the subtree again (#418). Gate the query on this
// and the first render matches the document; the address is adopted on the next one.
//
// The cost is one extra render on mount, and a page that reads the query paints its
// default for that one frame.
export function useHydrated(): boolean {
    const [hydrated, setHydrated] = useState(false);
    useEffect(() => {
        setHydrated(true);
    }, []);
    return hydrated;
}

// The address as the prerendered document saw it: empty. Shared so a route gating its
// query on hydration does not allocate one per render.
export const NO_QUERY = new URLSearchParams();

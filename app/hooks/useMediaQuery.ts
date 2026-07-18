// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";

// Tracks whether a CSS media query matches, re-rendering when it changes. Starts false
// so the server-rendered and first client render agree (no hydration mismatch); the real
// value is read after mount. Use for layout decisions a CSS breakpoint can't express —
// e.g. "a short viewport" (a phone in landscape), where width alone misleads.
export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(false);
    useEffect(() => {
        // matchMedia is absent in jsdom (and any non-browser host), so a component
        // that reads a query stays on its safe default there instead of throwing.
        if (typeof window.matchMedia !== "function") {
            return;
        }
        const list = window.matchMedia(query);
        const update = () => setMatches(list.matches);
        update();
        list.addEventListener("change", update);
        return () => list.removeEventListener("change", update);
    }, [query]);
    return matches;
}

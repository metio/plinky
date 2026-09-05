// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect } from "react";
import { useLocation } from "react-router";

// Lands the page on the section its address names — /help#play, /settings#lights — which
// a client-router navigation does not do on its own. Read off the router's location
// rather than the window, so a change of hash on a page already open scrolls too, and
// the one place the reduced-motion preference is honoured for it.
export function useScrollToHash(): void {
    const { hash } = useLocation();
    useEffect(() => {
        const anchor = hash.slice(1);
        if (!anchor) {
            return;
        }
        const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
        document.getElementById(anchor)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    }, [hash]);
}

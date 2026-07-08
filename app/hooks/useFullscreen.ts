// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { type RefObject, useCallback, useEffect, useRef, useState } from "react";

type WakeLockSentinel = { release: () => Promise<void> };
type WakeLockNavigator = Navigator & {
    wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
};

// An installed PWA already runs without browser chrome, so the Fullscreen API has no URL
// bar to reclaim there — and on Android it is worse than useless: entering it hands the play
// surface to Chrome's fullscreen-back handling, so a finished run's programmatic exit drops
// the player back a page, out of the piece and into wherever they came from. In standalone
// display-mode we keep the in-page overlay (identical when there is no chrome to hide) and
// never call the real API. matchMedia is optional-chained: it is absent under jsdom, where
// this reads as "not standalone".
const inStandalonePwa = () =>
    (typeof window !== "undefined" &&
        window.matchMedia?.("(display-mode: standalone)").matches === true) ||
    (typeof navigator !== "undefined" &&
        (navigator as Navigator & { standalone?: boolean }).standalone === true);

// Drives a "play full screen" mode for the referenced element. Uses the Fullscreen API
// where available — on a phone that reclaims the browser chrome (the URL bar), the exact
// space the keyboard otherwise steals — and falls back to a plain in-page overlay (the
// `fullscreen` flag) where it isn't (notably iOS Safari, which only fullscreens video).
// Holds a screen wake lock while active so the screen doesn't dim mid-piece.
export function useFullscreen(ref: RefObject<HTMLElement | null>) {
    const [fullscreen, setFullscreen] = useState(false);
    const wakeLock = useRef<WakeLockSentinel | null>(null);

    // The browser can leave fullscreen on its own (Esc, a system gesture); mirror that
    // back into our state so the overlay styling and exit button stay in sync.
    useEffect(() => {
        const sync = () => {
            if (!document.fullscreenElement) {
                setFullscreen(false);
            }
        };
        document.addEventListener("fullscreenchange", sync);
        return () => document.removeEventListener("fullscreenchange", sync);
    }, []);

    // Keep the screen awake while playing full screen; release it on exit. Best-effort —
    // the Wake Lock API isn't everywhere, and a denied request is fine.
    useEffect(() => {
        if (!fullscreen) {
            return;
        }
        let cancelled = false;
        const nav = navigator as WakeLockNavigator;
        nav.wakeLock
            ?.request("screen")
            .then((lock) => {
                if (cancelled) {
                    lock.release().catch(() => {});
                } else {
                    wakeLock.current = lock;
                }
            })
            .catch(() => {});
        return () => {
            cancelled = true;
            wakeLock.current?.release().catch(() => {});
            wakeLock.current = null;
        };
    }, [fullscreen]);

    const enter = useCallback(() => {
        setFullscreen(true);
        // Skip the real API in an installed PWA — the overlay alone is full screen there,
        // and asking Chrome-for-Android for fullscreen is what bounces a finished run back
        // a page. Elsewhere the request reclaims the URL bar the on-screen keyboard needs.
        if (!inStandalonePwa()) {
            ref.current?.requestFullscreen?.().catch(() => {});
        }
    }, [ref]);

    const exit = useCallback(() => {
        setFullscreen(false);
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        }
    }, []);

    return { fullscreen, enter, exit };
}

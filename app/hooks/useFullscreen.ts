// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { type RefObject, useCallback, useEffect, useRef, useState } from "react";

type WakeLockSentinel = { release: () => Promise<void> };
type WakeLockNavigator = Navigator & {
    wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
};

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
        ref.current?.requestFullscreen?.().catch(() => {});
    }, [ref]);

    const exit = useCallback(() => {
        setFullscreen(false);
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        }
    }, []);

    return { fullscreen, enter, exit };
}

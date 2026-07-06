// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import { useAudioEngine } from "../contexts/services";

// The gestures a browser accepts as the user interaction that lets audio start.
// `touchend` (not `touchstart`) is what iOS Safari treats as the completed tap.
const GESTURES = ["pointerdown", "keydown", "touchend"] as const;

// Keeps audio audible for the whole visit and reports when the visitor has first
// engaged.
//
// A note press already resumes the context, but a surface that opens it from an
// effect rather than a tap — the metronome loop, score autoplay — parks it
// suspended, and on iOS a later resume() alone may not wake it. So every gesture,
// not just the first, runs unlock(): it configures the Silent-Mode-defeating audio
// session once and re-resumes a context that an interruption (a call, Siri, a route
// change, the tab backgrounding) left suspended. A tab returning to the foreground
// re-resumes too, since iOS suspends audio while hidden. unlock() is cheap on an
// already-running context, so re-running it per gesture just guarantees recovery.
//
// Returns whether a gesture has occurred, so a caller can hold an audio-related
// hint back until the visitor has actually engaged rather than showing it on a
// cold page load.
export function useAudioUnlock(): boolean {
    const audio = useAudioEngine();
    const [interacted, setInteracted] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }
        const unlock = () => {
            audio.unlock();
            setInteracted(true);
        };
        const onVisible = () => {
            if (document.visibilityState === "visible") {
                audio.resume();
            }
        };
        for (const type of GESTURES) {
            window.addEventListener(type, unlock, { passive: true });
        }
        document.addEventListener("visibilitychange", onVisible);
        return () => {
            for (const type of GESTURES) {
                window.removeEventListener(type, unlock);
            }
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, [audio]);

    return interacted;
}

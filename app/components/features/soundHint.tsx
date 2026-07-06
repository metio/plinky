// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useSyncExternalStore } from "react";
import { useHintsStore } from "../../contexts/services";
import { useAudioUnlock } from "../../hooks/useAudioUnlock";
import { m } from "../../paraglide/messages.js";

const HINT_ID = "ios-sound";

// Ensures the visitor can actually hear the app. It runs the audio unlock for
// everyone (priming a context that some non-gesture surface opened suspended),
// and on iOS — where Silent Mode mutes Web Audio through a channel the app can
// neither read nor override — it surfaces a one-time, dismissible tip once the
// visitor has interacted, so it never greets a cold page load. Inside a social
// app's in-app browser, where sound is blocked outright, the tip instead points to
// opening the page in Safari — the actionable fix there, so it takes precedence.
export function SoundHint({ iosLike, inAppBrowser }: { iosLike: boolean; inAppBrowser: boolean }) {
    const interacted = useAudioUnlock();
    const hints = useHintsStore();
    // Server render and the pre-dismiss default both treat the hint as already
    // seen, so nothing flashes before hydration reads the real value.
    const seen = useSyncExternalStore(
        hints.subscribe,
        () => hints.seen(HINT_ID),
        () => true,
    );

    if (!iosLike || !interacted || seen) {
        return null;
    }
    return (
        <div
            role="status"
            className="border-b border-sky-300 bg-sky-50 px-6 py-2 dark:border-sky-800 dark:bg-sky-950"
        >
            <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
                <p className="text-sm text-sky-900 dark:text-sky-200">
                    {inAppBrowser ? m.sound_inapp_hint() : m.sound_ios_hint()}
                </p>
                <button
                    type="button"
                    onClick={() => hints.markSeen(HINT_ID)}
                    aria-label={m.action_dismiss()}
                    className="text-sky-900 hover:text-sky-700 dark:text-sky-200 dark:hover:text-sky-100"
                >
                    ✕
                </button>
            </div>
        </div>
    );
}

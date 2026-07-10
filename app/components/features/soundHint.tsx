// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useSyncExternalStore } from "react";
import { useHintsStore } from "../../contexts/services";
import { useAudioUnlock } from "../../hooks/useAudioUnlock";
import { m } from "../../paraglide/messages.js";
import { Banner } from "../ui/banner";

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
        <Banner
            tone="sky"
            onDismiss={() => hints.markSeen(HINT_ID)}
            dismissLabel={m.action_dismiss()}
        >
            {inAppBrowser ? m.sound_inapp_hint() : m.sound_ios_hint()}
        </Banner>
    );
}

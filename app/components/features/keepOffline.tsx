// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect } from "react";
import { usePrefs } from "../../hooks/usePrefs";
import { getLocale } from "../../paraglide/runtime.js";

// While the setting is on, every visit asks the worker to keep this language's pages on
// the device. Every visit, because a new build empties what the last one held; the
// worker itself skips whatever it already has. The announcer is handed in from the
// composition root, so this reads no browser global of its own.
export function KeepOffline({ announce }: { announce: (locale: string) => void }) {
    const { prefs } = usePrefs();
    const keep = prefs.keepOffline;
    useEffect(() => {
        if (keep) {
            announce(getLocale());
        }
    }, [keep, announce]);
    return null;
}

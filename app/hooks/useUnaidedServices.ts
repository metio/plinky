// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo } from "react";
import { unaidedPrefs } from "../../core/prefs";
import { type AppServices, useServices } from "../contexts/services";
import { createFixedPrefsStore } from "../stores/fixedPrefsStore";

// The services a surface runs on with the reading aids fixed off — the keyboard tour,
// which teaches finding a key on a keyboard that must not label them, and the placement
// test, which measures reading and so cannot show the notes falling or coloured. One
// rule in one place: what counts as unaided is decided in core, and the moment the
// player's own preferences are snapshotted is decided here, for both.
export function useUnaidedServices(): AppServices {
    const services = useServices();
    return useMemo(
        () => ({
            ...services,
            prefs: createFixedPrefsStore(unaidedPrefs(services.prefs.load())),
        }),
        [services],
    );
}

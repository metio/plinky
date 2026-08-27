// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useSyncExternalStore } from "react";
import { m } from "../../paraglide/messages.js";
import type { StorageHealth } from "../../ports/storageHealth";
import { Banner } from "../ui/banner";

// A single, dismissible warning that progress is not being persisted, shown the
// moment any storage write fails. Every save funnels through one adapter, so
// one banner covers them all; actions with their own "saved" indicator (like
// saving a take) still show a local failure message next to the action.
export function StorageBanner({ health }: { health: StorageHealth }) {
    const problem = useSyncExternalStore(health.subscribe, health.problem, () => null);
    // Dismissal lasts only until the next page load, deliberately: it cannot be
    // persisted (storage is the thing that's failing), and a fresh visit with a
    // still-broken store deserves a fresh warning.
    const [dismissed, setDismissed] = useState(false);
    if (problem === null || dismissed) {
        return null;
    }
    return (
        <Banner
            tone="amber"
            role="alert"
            onDismiss={() => setDismissed(true)}
            dismissLabel={m.action_dismiss()}
        >
            {problem === "stale" ? m.storage_stale_build() : m.storage_write_failed()}
        </Banner>
    );
}

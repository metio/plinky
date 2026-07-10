// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useState, useSyncExternalStore } from "react";
import { m } from "../../paraglide/messages.js";
import { Banner } from "../ui/banner";

// The signal the banner watches: whether a storage write has failed on this
// device. Structural on purpose — the browser-store adapter satisfies it and a
// test hands in a stub, so the banner never imports the adapter it reports on.
export type StorageHealth = {
    failed(): boolean;
    subscribe(onChange: () => void): () => void;
};

// A single, dismissible warning that progress is not being persisted, shown the
// moment any storage write fails. Every save funnels through one adapter, so
// one banner covers them all; actions with their own "saved" indicator (like
// saving a take) still show a local failure message next to the action.
export function StorageBanner({ health }: { health: StorageHealth }) {
    const failed = useSyncExternalStore(health.subscribe, health.failed, () => false);
    // Dismissal lasts only until the next page load, deliberately: it cannot be
    // persisted (storage is the thing that's failing), and a fresh visit with a
    // still-broken store deserves a fresh warning.
    const [dismissed, setDismissed] = useState(false);
    if (!failed || dismissed) {
        return null;
    }
    return (
        <Banner
            tone="amber"
            role="alert"
            onDismiss={() => setDismissed(true)}
            dismissLabel={m.action_dismiss()}
        >
            {m.storage_write_failed()}
        </Banner>
    );
}

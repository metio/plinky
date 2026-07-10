// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useState } from "react";
import { m } from "../../paraglide/messages.js";
import { Banner } from "../ui/banner";

// A single, dismissible notice that a newer build is waiting to take over. The
// composition root owns the service-worker plumbing and hands this banner a plain
// boolean plus callbacks, so the banner never touches navigator.serviceWorker
// itself and renders identically under a jsdom test.
export function UpdateBanner({
    updateReady,
    updateBroken = false,
    onReload,
}: {
    updateReady: boolean;
    // The opposite failure: the service worker could not be registered at all,
    // so this device will stop receiving new versions. A quiet, dismissible
    // notice — the app itself keeps working.
    updateBroken?: boolean;
    onReload: () => void;
}) {
    // Dismissal lasts only until the next page load: a new version stays worth
    // offering on a fresh visit, and the notice never persists (nor needs to).
    const [dismissed, setDismissed] = useState(false);
    if (dismissed) {
        return null;
    }
    if (!updateReady) {
        if (!updateBroken) {
            return null;
        }
        return (
            <Banner
                tone="amber"
                onDismiss={() => setDismissed(true)}
                dismissLabel={m.action_dismiss()}
            >
                {m.update_broken()}
            </Banner>
        );
    }
    return (
        <Banner
            tone="indigo"
            onDismiss={() => setDismissed(true)}
            dismissLabel={m.action_dismiss()}
            actions={
                <button
                    type="button"
                    onClick={onReload}
                    className="rounded-md bg-indigo-600 px-3 py-1 text-sm font-medium text-white hover:bg-indigo-500"
                >
                    {m.update_reload()}
                </button>
            }
        >
            {m.update_available()}
        </Banner>
    );
}

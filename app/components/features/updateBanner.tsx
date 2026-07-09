// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useState } from "react";
import { m } from "../../paraglide/messages.js";

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
            <div
                role="status"
                className="border-b border-amber-300 bg-amber-50 px-6 py-2 dark:border-amber-800 dark:bg-amber-950"
            >
                <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
                    <p className="text-sm text-amber-900 dark:text-amber-200">
                        {m.update_broken()}
                    </p>
                    <button
                        type="button"
                        onClick={() => setDismissed(true)}
                        aria-label={m.action_dismiss()}
                        className="text-amber-900 hover:text-amber-700 dark:text-amber-200 dark:hover:text-amber-100"
                    >
                        ✕
                    </button>
                </div>
            </div>
        );
    }
    return (
        <div
            role="status"
            className="border-b border-indigo-300 bg-indigo-50 px-6 py-2 dark:border-indigo-800 dark:bg-indigo-950"
        >
            <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
                <p className="text-sm text-indigo-900 dark:text-indigo-200">
                    {m.update_available()}
                </p>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={onReload}
                        className="rounded-md bg-indigo-600 px-3 py-1 text-sm font-medium text-white hover:bg-indigo-500"
                    >
                        {m.update_reload()}
                    </button>
                    <button
                        type="button"
                        onClick={() => setDismissed(true)}
                        aria-label={m.action_dismiss()}
                        className="text-indigo-900 hover:text-indigo-700 dark:text-indigo-200 dark:hover:text-indigo-100"
                    >
                        ✕
                    </button>
                </div>
            </div>
        </div>
    );
}

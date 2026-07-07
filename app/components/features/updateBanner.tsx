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
    onReload,
}: {
    updateReady: boolean;
    onReload: () => void;
}) {
    // Dismissal lasts only until the next page load: a new version stays worth
    // offering on a fresh visit, and the notice never persists (nor needs to).
    const [dismissed, setDismissed] = useState(false);
    if (!updateReady || dismissed) {
        return null;
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

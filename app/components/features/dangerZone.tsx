// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useState } from "react";
import { resetDevice } from "../../lib/resetDevice";
import { m } from "../../paraglide/messages.js";

const OUTLINE =
    "rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950";
const SOLID = "rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500";
const CANCEL =
    "rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300";

// Erase all of this device's Plinky data and start fresh. Destructive and
// irreversible, so it sits behind a two-step confirm; the copy points at the Library
// backup for anyone who wants to keep their scores first.
export function DangerZone() {
    const [confirming, setConfirming] = useState(false);

    const reset = () => {
        resetDevice();
        window.location.reload();
    };

    return (
        <section className="space-y-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {m.settings_danger_heading()}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{m.settings_reset_help()}</p>
            {confirming ? (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-red-700 dark:text-red-300">
                        {m.settings_reset_confirm()}
                    </span>
                    <button type="button" onClick={reset} className={SOLID}>
                        {m.settings_reset_yes()}
                    </button>
                    <button type="button" onClick={() => setConfirming(false)} className={CANCEL}>
                        {m.settings_reset_cancel()}
                    </button>
                </div>
            ) : (
                <button type="button" onClick={() => setConfirming(true)} className={OUTLINE}>
                    {m.settings_reset()}
                </button>
            )}
        </section>
    );
}

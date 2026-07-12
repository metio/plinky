// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { type ReactNode, useState } from "react";
import { m } from "../../paraglide/messages.js";

// The daily challenge as a small present: until opened, the day's phrase hides
// behind one inviting button, and opening it plays a gentle rise-in. Only the
// first, unplayed visit gets the ceremony — a finished daily shows its result
// straight away (`alreadyOpen`), and reduced motion skips the animation.
export function DailyReveal({
    alreadyOpen,
    children,
}: {
    alreadyOpen: boolean;
    children: ReactNode;
}) {
    const [opened, setOpened] = useState(false);

    if (alreadyOpen || opened) {
        return (
            <div className={opened ? "animate-daily-reveal motion-reduce:animate-none" : ""}>
                {children}
            </div>
        );
    }

    return (
        <button
            type="button"
            onClick={() => setOpened(true)}
            className="flex w-full flex-col items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50/50 px-6 py-12 text-center transition hover:border-indigo-300 hover:shadow-md dark:border-indigo-900 dark:bg-indigo-950/30 dark:hover:border-indigo-700"
        >
            <span aria-hidden="true" className="animate-bounce text-5xl motion-reduce:animate-none">
                🎁
            </span>
            <span className="text-lg font-medium text-indigo-800 dark:text-indigo-200">
                {m.daily_reveal()}
            </span>
        </button>
    );
}

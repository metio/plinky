// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { type ReactNode, useState } from "react";
import { m } from "../../paraglide/messages.js";

// The daily challenge as a small present: until opened, the day's phrase hides
// behind one inviting button, and opening it plays a gentle rise-in. Only the
// first, unplayed visit gets the ceremony — a finished daily shows its result
// straight away (`alreadyOpen`), and reduced motion skips the animation.
export function DailyReveal({
    alreadyOpen,
    onOpen,
    children,
}: {
    alreadyOpen: boolean;
    // Called when the present is opened here. The day it belongs to lives on the page,
    // not in the present, so the caller reports the moment with the day in hand.
    onOpen?: () => void;
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
            onClick={() => {
                setOpened(true);
                onOpen?.();
            }}
            className="flex w-full flex-col items-center gap-3 rounded-xl border border-accent-line bg-accent-surface/50 px-6 py-12 text-center transition hover:border-accent-line-strong hover:shadow-md dark:bg-accent-surface/30"
        >
            <span aria-hidden="true" className="animate-bounce text-5xl motion-reduce:animate-none">
                🎁
            </span>
            <span className="text-lg font-medium text-accent-deep">{m.daily_reveal()}</span>
        </button>
    );
}

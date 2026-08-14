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
            // Wrapped in the same brass the day's warm-up is chipped in, because that
            // chip is what leads here. Half-strength accent over the paper came out a
            // cold grey — the one cool block in a warm app, and a poor present.
            className="flex w-full flex-col items-center gap-3 rounded-xl border border-spark-soft bg-spark-surface px-6 py-12 text-center transition hover:border-spark hover:shadow-md"
        >
            <span aria-hidden="true" className="animate-bounce text-5xl motion-reduce:animate-none">
                🎁
            </span>
            <span className="text-lg font-medium text-spark-strong">{m.daily_reveal()}</span>
        </button>
    );
}

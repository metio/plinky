// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { type ReactNode, useEffect, useState } from "react";
import { useHintsStore } from "../../contexts/services";
import { m } from "../../paraglide/messages.js";
import { CloseIcon } from "../ui/icons";

// A gentle, once-only tip that points out a feature the first time the player reaches it,
// then never again — discovery without a forced tour. Starts hidden so the server and
// first client render agree; appears after mount only if this hint hasn't been seen.
// Dismissing (or its first showing) marks it seen for good.
export function CoachMark({ id, children }: { id: string; children: ReactNode }) {
    const hints = useHintsStore();
    const [show, setShow] = useState(false);
    useEffect(() => {
        if (!hints.seen(id)) {
            setShow(true);
        }
    }, [id, hints]);

    if (!show) {
        return null;
    }
    const dismiss = () => {
        hints.markSeen(id);
        setShow(false);
    };
    return (
        <div
            role="note"
            className="flex items-start justify-between gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-200"
        >
            <span>{children}</span>
            <button
                type="button"
                onClick={dismiss}
                aria-label={m.action_dismiss()}
                className="shrink-0 p-1 leading-none"
            >
                <CloseIcon className="h-4 w-4" />
            </button>
        </div>
    );
}

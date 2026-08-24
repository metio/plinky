// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useLatest } from "./useLatest";
import { type RefObject, useEffect, useRef } from "react";

// A menu that closes the way every other menu on every other site closes: press somewhere
// else, or hit Escape.
//
// Without it the only way out is pressing the trigger again — which means a player who has
// opened a menu and changed their mind has to find the one control that dismisses it, and
// every stray press lands on the page behind an overlay that is still there. It reads as
// broken rather than as strict.
//
// Returns a ref to put on the element that encloses BOTH the trigger and the panel. Enclosing
// the trigger matters: a press on it would otherwise count as "somewhere else", closing the
// menu on pointerdown before the trigger's own click could toggle it — so the menu would
// never open at all.
export function useDismissable<T extends HTMLElement>(
    open: boolean,
    close: () => void,
): RefObject<T | null> {
    const enclosing = useRef<T | null>(null);
    // Read through a ref so the listeners are attached once per opening rather than
    // re-attached on every render of whatever owns the menu.
    const closeRef = useLatest(close);

    useEffect(() => {
        if (!open) {
            return;
        }
        // Where focus was before the menu took it, so Escape can give it back. A menu that
        // closes and drops focus to the top of the document strands a keyboard user.
        const opener = document.activeElement;
        const onPointerDown = (event: PointerEvent) => {
            const target = event.target;
            if (target instanceof Node && !enclosing.current?.contains(target)) {
                closeRef.current();
            }
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") {
                return;
            }
            closeRef.current();
            if (opener instanceof HTMLElement) {
                opener.focus();
            }
        };
        // Pointerdown rather than click: a menu that waits for the full click stays open
        // under the finger, and the press that dismissed it would also land on whatever is
        // beneath. Captured, so a handler that stops the event on its way up cannot leave
        // the menu open for good.
        document.addEventListener("pointerdown", onPointerDown, true);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown, true);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [open]);

    return enclosing;
}

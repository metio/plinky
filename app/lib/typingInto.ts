// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Input types a key means nothing to: pressing 3 on a focused radio or button changes
// nothing, so a page-wide shortcut may take it.
const NOT_TYPED_INTO = new Set(["button", "checkbox", "radio", "range", "reset", "submit"]);

// Whether the focused element is somewhere the player is typing, where a key is theirs.
export function typingInto(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el) {
        return false;
    }
    if (el.isContentEditable || el.tagName === "TEXTAREA" || el.tagName === "SELECT") {
        return true;
    }
    return el.tagName === "INPUT" && !NOT_TYPED_INTO.has((el as HTMLInputElement).type);
}

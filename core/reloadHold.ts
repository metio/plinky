// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Whether a reload may happen yet.
//
// A new build taking over the tab reloads it, and a reload lands wherever the player
// happens to be — mid-run, that is a take thrown away. So a reload asked for while
// something is in progress is remembered instead, and paid out once the hold clears.
//
// The decision is the whole of the rule and none of the plumbing: what holds, and what
// reloads, are the caller's business. Kept here so the rule is a pure unit — the one a
// model can drive and a test can interrogate — rather than three flags inside a watcher
// that only a browser can run.

export type ReloadHold = {
    // Whether to reload now. When the answer is no, the reload is remembered.
    want(): boolean;
    // Whether to reload now on behalf of one that was remembered. Safe to ask at every
    // opportunity: it answers no unless something really is owed and nothing holds it.
    flush(): boolean;
    // Whether a reload is waiting for the hold to clear.
    owed(): boolean;
};

export function createReloadHold(held: () => boolean): ReloadHold {
    let owed = false;
    // A reload that fires clears the debt: what was owed has now happened, and a second
    // reload for the same change would only cost the player another page load.
    const want = (): boolean => {
        if (held()) {
            owed = true;
            return false;
        }
        owed = false;
        return true;
    };
    return {
        want,
        flush: () => (owed ? want() : false),
        owed: () => owed,
    };
}

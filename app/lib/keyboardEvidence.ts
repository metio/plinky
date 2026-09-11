// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createEmitter } from "../../core/emitter";

// Whether a key has been pressed on a keyboard of the player's own. No media query can say
// so: a tablet in a keyboard case reports a finger as its main pointer. A key press can,
// because a touch device's on-screen keyboard only ever types into a field. It is noted
// once and never forgotten for the rest of the session, since a keyboard that has typed
// once is still there.
export type KeyboardEvidence = {
    seen(): boolean;
    note(): void;
    subscribe(onChange: () => void): () => void;
};

export function createKeyboardEvidence(): KeyboardEvidence {
    let seen = false;
    const emitter = createEmitter();
    return {
        seen: () => seen,
        note() {
            if (!seen) {
                seen = true;
                emitter.notify();
            }
        },
        subscribe: emitter.subscribe,
    };
}

// The app-wide instance the default service set hands out, so a key pressed on one
// question still counts on the next, and on the next page.
export const sessionKeyboard: KeyboardEvidence = createKeyboardEvidence();

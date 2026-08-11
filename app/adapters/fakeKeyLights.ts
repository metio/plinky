// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { type LitKeys, NOTHING_LIT } from "../../core/keyLights";
import type { KeyLightsPort } from "../ports/keyLights";

// A lighted keyboard that keeps a ledger instead of glowing. Two surfaces, because
// the two things worth asserting are different questions:
//
//   `lit` — what the instrument would be showing right now. This is the one to assert
//   in a UI test: it says nothing about how the picture was reached.
//   `sent` — every picture handed over, in order. This is the one to assert when the
//   point is that a redundant update was NOT sent.
export type FakeKeyLights = KeyLightsPort & {
    lit(): LitKeys;
    sent(): LitKeys[];
};

export function fakeKeyLights(): FakeKeyLights {
    let current: LitKeys = NOTHING_LIT;
    const history: LitKeys[] = [];
    return {
        show(keys) {
            current = keys;
            history.push(keys);
        },
        clear() {
            current = NOTHING_LIT;
            history.push(NOTHING_LIT);
        },
        lit: () => current,
        sent: () => [...history],
    };
}

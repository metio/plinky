// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Analytics } from "../ports/analytics";

// A fake analytics capability for tests and the browser suite: records the consent
// it was told and never touches the DOM or the network. `consented` reads the last
// state so a test can assert opt-in flows without loading Google Analytics.
export function fakeAnalytics(): Analytics & { consented: () => boolean; calls: () => boolean[] } {
    const calls: boolean[] = [];
    return {
        setConsent(on) {
            calls.push(on);
        },
        consented: () => calls.at(-1) ?? false,
        calls: () => [...calls],
    };
}

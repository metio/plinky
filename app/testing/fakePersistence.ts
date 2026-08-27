// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { StoragePersistence } from "../ports/storagePersistence";

// A StoragePersistence that records what it was asked, so a test can assert that the app
// asked at the right moment rather than that the browser said yes — the browser's answer
// is not ours to control, and the bug this guards against is never asking.
export type FakePersistence = StoragePersistence & { asked: number };

export function fakePersistence(granted = true): FakePersistence {
    const fake: FakePersistence = {
        asked: 0,
        async ensure() {
            fake.asked += 1;
            return granted;
        },
    };
    return fake;
}

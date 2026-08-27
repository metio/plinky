// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { StoragePersistence } from "../ports/storagePersistence";

// The StorageManager behind the StoragePersistence port.
//
// `persisted()` is asked first for two reasons: it is the cheap answer when the grant
// already exists, and in the browsers that put the request to the player, asking again
// on every run would be nagging. Everything here degrades to false — an old browser
// without the API, a context where it throws, a player who declines. False means the
// data is evictable, which is exactly what was true before the call.
export const webStoragePersistence: StoragePersistence = {
    async ensure() {
        const manager = globalThis.navigator?.storage;
        if (typeof manager?.persisted !== "function" || typeof manager.persist !== "function") {
            return false;
        }
        try {
            return (await manager.persisted()) || (await manager.persist());
        } catch {
            return false;
        }
    },
};

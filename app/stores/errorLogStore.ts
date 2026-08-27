// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { foldError, type Incoming, type LoggedError, parseErrorLog } from "../../core/errorLog";
import type { KeyValueStore } from "../ports/keyValueStore";
import { createJsonStore, type JsonStore, parseJson } from "./jsonStore";

// What went wrong on this device lately (see core/errorLog).
//
// Persisted rather than held in memory, because the faults worth reading about are
// exactly the ones that took the page with them: a reader who reloads to recover has to
// find the record still there afterwards, or it describes only the crashes mild enough
// not to matter.

const KEY = "plinky:errors";

export type ErrorLogStore = JsonStore<LoggedError[]> & {
    // Fold one fault in. Returns whether it was written down — a device that cannot
    // store the record is itself a thing worth knowing, though nowhere to say so.
    record(incoming: Incoming): boolean;
    // Forget the lot, once a reader has sent or dismissed them.
    clear(): boolean;
};

export function createErrorLogStore(kv: KeyValueStore): ErrorLogStore {
    const store = createJsonStore<LoggedError[]>(kv, KEY, (raw) =>
        parseJson(raw, [], parseErrorLog),
    );
    return {
        ...store,
        record(incoming) {
            return store.save(foldError(store.load(), incoming));
        },
        clear() {
            return store.save([]);
        },
    };
}

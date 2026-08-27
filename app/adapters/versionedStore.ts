// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { SCHEMA_VERSION, type SchemaStanding, schemaStanding } from "../../core/schema";
import type { KeyValueStore } from "../ports/keyValueStore";

// The key the device's shape is stamped under. Namespaced like everything else, so a
// device reset and the progress backup carry it with the rest.
export const SCHEMA_KEY = "plinky:schema";

// A store that will not write over values a newer build wrote.
//
// Wrapping the store rather than teaching every one of the two dozen stores about
// versions puts the decision in one place, and means the refusal arrives as an ordinary
// write verdict — which every caller already handles, because `set` has always been
// allowed to say no.
//
// Reads are never blocked. A player on a stale tab must still be able to see their
// progress and download a backup of it; taking that away would turn a recoverable
// situation into the loss it exists to prevent.
export function versionedStore(
    inner: KeyValueStore,
    known: number = SCHEMA_VERSION,
): { store: KeyValueStore; standing: SchemaStanding } {
    const standing = schemaStanding(inner.get(SCHEMA_KEY), known);
    if (standing !== "newer" && standing !== "current") {
        // Stamp on the way past. An unstamped device is this shape by definition, and an
        // older one has been brought forward by whatever migration ran — there are none
        // yet, this being the first version.
        inner.set(SCHEMA_KEY, String(known));
    }
    if (standing !== "newer") {
        return { store: inner, standing };
    }
    return {
        standing,
        store: {
            get: inner.get,
            keys: inner.keys,
            // Refused rather than attempted. The write would succeed at the storage
            // layer and destroy exactly what it was meant to preserve.
            set: () => false,
            remove: () => {},
        },
    };
}

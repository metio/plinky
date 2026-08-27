// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Whether this device is accepting writes, and if not, why.
//
// A port rather than a shape the banner declares and the adapter happens to satisfy: two
// layers need the same answer — the adapter that knows it, the banner that shows it —
// and neither may import the other.
export type StorageProblem =
    // Writes are landing.
    | null
    // The device refused one: a full quota, or storage denied outright.
    | "refused"
    // This tab is running an older build than the device has been written by. Writing
    // would overwrite a shape this build cannot represent, so it does not.
    | "stale";

export type StorageHealth = {
    problem(): StorageProblem;
    subscribe(onChange: () => void): () => void;
};

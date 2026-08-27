// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Faults the page never got to handle.
//
// React's boundaries catch a throw during render and offer the reader a way to report
// it. Everything else — a rejected promise, a throw from a timer or an event handler —
// reaches the window and stops there. This is the seam that hears those, so what listens
// for them is a capability the composition root wires rather than a global reached for
// wherever it happens to be needed.
export interface ErrorFeed {
    // Call `onFault` for each unhandled error, with what threw and where. Returns the
    // teardown. `message` is untrusted and unbounded — whatever threw decided it — so
    // the reader of this feed bounds it rather than the feed itself.
    subscribe(onFault: (fault: { message: string; where: string }) => void): () => void;
}

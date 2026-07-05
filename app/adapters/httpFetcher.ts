// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Fetcher } from "../ports/fetcher";

// The browser implementation of the network seam. Callers depend on the Fetcher
// type, so a test can swap in a lambda without touching the global.

// Same-origin assets are small and the third-party news query is tiny; a request
// still open this long has stalled, not merely slowed. An abort rejects the promise
// so the caller's retry / empty-answer path runs, instead of the await hanging
// forever and stranding whatever awaited it (the home page's news fetch most of all).
const DEFAULT_TIMEOUT_MS = 15_000;

export function createHttpFetcher(timeoutMs = DEFAULT_TIMEOUT_MS): Fetcher {
    return (url) => fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
}

export const httpFetcher = createHttpFetcher();

// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Fetcher } from "../ports/fetcher";

// The browser implementation of the network seam. Deliberately trivial: the
// value is the seam itself — callers depend on the Fetcher type, so a test can
// swap in a lambda without touching the global.
export const httpFetcher: Fetcher = (url) => fetch(url);

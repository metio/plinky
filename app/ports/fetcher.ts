// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The network seam: how an asset (a catalogue manifest, a song's compressed
// MusicXML, the third-party news query) is fetched. A function type rather than an
// interface — the whole capability is one call — so a test's fake is a lambda
// returning a canned Response. The optional `init` forwards request options; the
// news source passes `cache: "no-store"` so a toggled banner is never served stale
// from the browser cache, while the immutable catalogue assets omit it and cache.
export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

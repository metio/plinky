// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The network seam: how a same-origin asset (a catalogue manifest, a song's
// compressed MusicXML) is fetched. A function type rather than an interface —
// the whole capability is one call — so a test's fake is a lambda returning a
// canned Response.
export type Fetcher = (url: string) => Promise<Response>;

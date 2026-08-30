// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Types for functions/_middleware.js, which stays plain JavaScript because Cloudflare runs
// the file as it is shipped — nothing compiles it on the way to the edge.

// The slice of Cloudflare's EventContext this middleware touches. Narrow on purpose: what
// it needs is the asset server's answer, and typing exactly that keeps the test's fake
// honest — a fake built to a wider type could satisfy the compiler while standing in for
// something the real runtime never passes.
export type AssetContext = {
    next: () => Promise<Response>;
};

export function onRequest(context: AssetContext): Promise<Response>;

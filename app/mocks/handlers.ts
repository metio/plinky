// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { http, HttpResponse } from "msw";

// Default request handlers for everything the app fetches at runtime: the song and
// exercise catalogues and their compressed scores. They return empty/absent by default
// so a test that doesn't care gets a deterministic answer; a test that does care
// overrides a route with `server.use(...)`. Intercepting at this layer (not by stubbing
// the global fetch) keeps every test isolated — no stub can leak to the next one.
export const handlers = [
    http.get("*/songs/manifest.json", () => HttpResponse.json([])),
    http.get("*/songs/:dir/:id.mxl", () => new HttpResponse(null, { status: 404 })),
    http.get("*/exercises/manifest.json", () => HttpResponse.json([])),
    http.get("*/exercises/studies/:cid.mxl", () => new HttpResponse(null, { status: 404 })),
    // The Sanity query API (news, help, board): an empty result by default, so a
    // test that wires a real Sanity adapter gets "no content" — the same answer an
    // empty project gives — unless it overrides the route with a payload.
    http.get("https://*.apicdn.sanity.io/*", () => HttpResponse.json({ result: null })),
];

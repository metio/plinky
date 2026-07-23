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
];

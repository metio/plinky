// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { server } from "../test-setup.node";
import { loadFavorites } from "./favorites";
import { ensureSeeded, loadManifest } from "./songs";

afterEach(() => localStorage.clear());

describe("loadManifest", () => {
    it("returns an empty catalogue when the manifest can't be fetched", async () => {
        server.use(
            http.get("*/songs/manifest.json", () => new HttpResponse(null, { status: 500 })),
        );
        expect(await loadManifest()).toEqual([]);
    });
});

describe("ensureSeeded", () => {
    it("stars the seed songs once and is idempotent", async () => {
        let seedFetches = 0;
        server.use(
            http.get("*/songs/seed.json", () => {
                seedFetches++;
                return HttpResponse.json(["s1", "s2"]);
            }),
        );
        await ensureSeeded();
        expect([...loadFavorites()].sort()).toEqual(["s1", "s2"]);
        await ensureSeeded();
        // The second call short-circuits on its persisted flag — no re-fetch.
        expect(seedFetches).toBe(1);
    });
});

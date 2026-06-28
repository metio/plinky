// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { loadFavorites } from "./favorites";
import { ensureSeeded, loadManifest } from "./songs";

afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    // restoreAllMocks doesn't undo stubGlobal, so the fetch stub would otherwise leak to
    // whatever runs next in the worker and flake a test that asserts on fetch.
    vi.unstubAllGlobals();
});

describe("loadManifest", () => {
    it("returns an empty catalogue when the manifest can't be fetched", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
        expect(await loadManifest()).toEqual([]);
    });
});

describe("ensureSeeded", () => {
    it("stars the seed songs once and is idempotent", async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ["s1", "s2"] });
        vi.stubGlobal("fetch", fetchMock);
        await ensureSeeded();
        expect([...loadFavorites()].sort()).toEqual(["s1", "s2"]);
        await ensureSeeded();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});

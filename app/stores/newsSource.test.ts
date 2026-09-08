// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it, vi } from "vitest";
import { createNewsSource } from "./newsSource";

const release = { date: "2026-09-08", label: null, entries: [{ body: "**New.**", twip: true }] };

const answering = (value: unknown, ok = true) =>
    vi.fn(async () => new Response(JSON.stringify(value), { status: ok ? 200 : 404 }));

describe("the changelog behind the page", () => {
    it("reads the releases from the file beside the site", async () => {
        const fetcher = answering([release]);
        expect(await createNewsSource(fetcher).releases()).toEqual([release]);
        expect(fetcher).toHaveBeenCalledWith("/news.json");
    });

    it("asks once however many readers there are", async () => {
        // Two components on one page must not each fetch a hundred and sixty kilobytes.
        const fetcher = answering([release]);
        const source = createNewsSource(fetcher);
        await Promise.all([source.releases(), source.releases()]);
        await source.releases();
        expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it("answers nothing rather than an empty list when the file is unreachable", async () => {
        // The page keeps the releases it shipped with. An empty list would replace real
        // news with a blank page every time the network hiccuped.
        expect(await createNewsSource(answering(null, false)).releases()).toBeNull();
        expect(
            await createNewsSource(
                vi.fn(async () => Promise.reject(new Error("offline"))),
            ).releases(),
        ).toBeNull();
    });

    it("answers nothing for a file that is not the changelog", async () => {
        expect(await createNewsSource(answering({ releases: [] })).releases()).toBeNull();
        expect(await createNewsSource(answering([{ date: 1 }])).releases()).toBeNull();
        expect(await createNewsSource(answering(["a string"])).releases()).toBeNull();
    });

    it("takes a changelog with nothing in it yet", async () => {
        expect(await createNewsSource(answering([])).releases()).toEqual([]);
    });
});

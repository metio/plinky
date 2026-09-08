// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it, vi } from "vitest";
import { createPeopleSource } from "./peopleSource";

const answering = (body: unknown, ok = true) =>
    vi.fn(async () => new Response(JSON.stringify(body), { status: ok ? 200 : 404 }));

describe("createPeopleSource", () => {
    it("fetches a language's file once and keeps it for the session", async () => {
        const fetcher = answering({ "frederic-chopin": { about: "Polish composer" } });
        const source = createPeopleSource(fetcher);

        const [first, second] = await Promise.all([source.about("de"), source.about("de")]);

        expect(first?.["frederic-chopin"]?.about).toBe("Polish composer");
        expect(second).toEqual(first);
        expect(await source.about("de")).toEqual(first);
        expect(fetcher).toHaveBeenCalledOnce();
        expect(fetcher).toHaveBeenCalledWith("/people/de.json");
    });

    it("fetches each language separately", async () => {
        const fetcher = answering({});
        const source = createPeopleSource(fetcher);
        await source.about("de");
        await source.about("fr");
        expect(fetcher.mock.calls.map((call: unknown[]) => call[0])).toEqual([
            "/people/de.json",
            "/people/fr.json",
        ]);
    });

    it("answers null for a fetch that failed, and asks again next time", async () => {
        // Unknown, not empty: a page that took null for "nobody is described" would drop
        // every composer's line for the rest of a session that began offline.
        const fetcher = vi
            .fn()
            .mockRejectedValueOnce(new Error("offline"))
            .mockResolvedValueOnce(new Response(JSON.stringify({ a: { about: "x" } })));
        const source = createPeopleSource(fetcher);

        expect(await source.about("en")).toBeNull();
        expect(await source.about("en")).toEqual({ a: { about: "x" } });
    });

    it("refuses a body of the wrong shape", async () => {
        expect(await createPeopleSource(answering([1, 2])).about("en")).toBeNull();
        expect(await createPeopleSource(answering(null)).about("en")).toBeNull();
        expect(await createPeopleSource(answering({}, false)).about("en")).toBeNull();
    });
});

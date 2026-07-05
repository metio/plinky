// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import type { Fetcher } from "../ports/fetcher";
import { fetchManifest } from "./manifest";

type Meta = { id: string; title?: string };

const respond = (body: BodyInit | null, init?: ResponseInit): Fetcher => {
    return () => Promise.resolve(new Response(body, init));
};

describe("fetchManifest", () => {
    it("returns the entries of a completed fetch", async () => {
        const rows = [{ id: "a" }, { id: "b", title: "B" }];
        expect(await fetchManifest<Meta>(respond(JSON.stringify(rows)), "/m.json")).toEqual(rows);
    });

    it("returns null for a non-OK response, so nothing gets cached", async () => {
        expect(await fetchManifest<Meta>(respond(null, { status: 404 }), "/m.json")).toBeNull();
        expect(await fetchManifest<Meta>(respond(null, { status: 500 }), "/m.json")).toBeNull();
    });

    it("returns null when the fetch itself throws", async () => {
        const throwing: Fetcher = () => Promise.reject(new TypeError("network down"));
        expect(await fetchManifest<Meta>(throwing, "/m.json")).toBeNull();
    });

    it("returns null for a body that isn't JSON (captive portal HTML)", async () => {
        expect(await fetchManifest<Meta>(respond("<html>login</html>"), "/m.json")).toBeNull();
    });

    it("returns null for JSON that isn't an array (misconfigured server)", async () => {
        expect(
            await fetchManifest<Meta>(respond(JSON.stringify({ error: "oops" })), "/m.json"),
        ).toBeNull();
    });

    it("keeps an empty array — an empty catalogue is a completed answer", async () => {
        expect(await fetchManifest<Meta>(respond("[]"), "/m.json")).toEqual([]);
    });

    it("drops entries without a usable id instead of poisoning the list", async () => {
        const body = JSON.stringify([{ id: "ok" }, null, "junk", 7, { title: "no id" }]);
        expect(await fetchManifest<Meta>(respond(body), "/m.json")).toEqual([{ id: "ok" }]);
    });
});

// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttpFetcher } from "./httpFetcher";

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("httpFetcher", () => {
    it("passes an abort signal so a request can be cancelled", async () => {
        const fetchSpy = vi.fn((_url: string, _init?: RequestInit) =>
            Promise.resolve(new Response("ok")),
        );
        vi.stubGlobal("fetch", fetchSpy);
        await createHttpFetcher()("/manifest.json");
        expect(fetchSpy).toHaveBeenCalledWith("/manifest.json", expect.anything());
        expect(fetchSpy.mock.calls[0]![1]?.signal).toBeInstanceOf(AbortSignal);
    });

    it("forwards the caller's request options alongside the timeout signal", async () => {
        const fetchSpy = vi.fn((_url: string, _init?: RequestInit) =>
            Promise.resolve(new Response("ok")),
        );
        vi.stubGlobal("fetch", fetchSpy);
        await createHttpFetcher()("/news", { cache: "no-store" });
        expect(fetchSpy.mock.calls[0]![1]?.cache).toBe("no-store");
        expect(fetchSpy.mock.calls[0]![1]?.signal).toBeInstanceOf(AbortSignal);
    });

    it("aborts a request that outlasts the timeout instead of hanging forever", async () => {
        // A fetch that only ever settles when its signal aborts — a stalled connection.
        vi.stubGlobal(
            "fetch",
            (_url: string, init?: RequestInit) =>
                new Promise((_resolve, reject) => {
                    init?.signal?.addEventListener("abort", () =>
                        reject((init.signal as AbortSignal).reason),
                    );
                }),
        );
        await expect(createHttpFetcher(5)("/stalled")).rejects.toBeDefined();
    });
});

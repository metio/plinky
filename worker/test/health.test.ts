// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import worker, { corsConfig, type Env } from "../src/index";
import { flagsFrom } from "../src/routes/health";

const ORIGIN = "https://plinky.fun";

// The environment a test asks for, built here rather than read from the deployed
// settings. A handler that can only be tested against production's configuration is
// a handler whose tests change whenever a setting does — and every handler here takes
// its environment as an argument precisely so that they need not.
const withEnv = (overrides: Partial<Env> = {}): Env => ({
    ALLOWED_ORIGINS: ORIGIN,
    ...overrides,
});

const get = (path: string, headers: Record<string, string> = {}) =>
    worker.fetch(new Request(`https://api.plinky.fun${path}`, { headers }), withEnv());

describe("the health endpoint", () => {
    it("answers with a versioned envelope", async () => {
        const response = await get("/v1/health");

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            v: 1,
            ok: true,
            data: { flags: { results: false, submissions: false, daily: false, vault: false } },
        });
    });

    it("declares itself JSON and refuses to be sniffed as anything else", async () => {
        const response = await get("/v1/health");

        expect(response.headers.get("content-type")).toContain("application/json");
        expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    });

    it("is cacheable only briefly, because it is the kill switch", async () => {
        const response = await get("/v1/health");

        // A cached answer outlives the setting that produced it, so this number is how
        // long turning a capability off takes to reach everybody.
        expect(response.headers.get("cache-control")).toBe("public, max-age=60");
    });

    it("reports every capability off in a build with none configured", async () => {
        const response = await worker.fetch(
            new Request("https://api.plinky.fun/v1/health"),
            withEnv({
                FEATURE_RESULTS: undefined,
                FEATURE_SUBMISSIONS: undefined,
                FEATURE_DAILY: undefined,
                FEATURE_VAULT: undefined,
            }),
        );

        const body = (await response.json()) as { data: { flags: Record<string, boolean> } };
        expect(Object.values(body.data.flags).some(Boolean)).toBe(false);
    });

    it('turns a capability on only for exactly "on"', () => {
        expect(flagsFrom({ FEATURE_RESULTS: "on" }).results).toBe(true);
        // Everything else fails towards the state that spends nothing.
        for (const value of ["true", "1", "ON", "yes", "", undefined]) {
            expect(flagsFrom({ FEATURE_RESULTS: value }).results).toBe(false);
        }
    });

    it("refuses a write to a read", async () => {
        const response = await worker.fetch(
            new Request("https://api.plinky.fun/v1/health", { method: "POST" }),
            withEnv(),
        );

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ v: 1, ok: false, error: "bad_request" });
    });
});

describe("anything that is not a route", () => {
    it("refuses without saying what else exists", async () => {
        const response = await get("/v1/vault/whatever");

        expect(response.status).toBe(404);
        expect(await response.json()).toEqual({ v: 1, ok: false, error: "not_found" });
    });

    it("refuses the root as flatly as any other path", async () => {
        expect((await get("/")).status).toBe(404);
    });
});

describe("who may call the API", () => {
    it("answers a preflight for an allowed origin", async () => {
        const response = await worker.fetch(
            new Request("https://api.plinky.fun/v1/health", {
                method: "OPTIONS",
                headers: { origin: ORIGIN },
            }),
            withEnv(),
        );

        expect(response.status).toBe(204);
        expect(response.headers.get("access-control-allow-origin")).toBe(ORIGIN);
        // Without this the browser asks again on every call, and a preflight is a
        // billable request like any other.
        expect(Number(response.headers.get("access-control-max-age"))).toBeGreaterThan(0);
    });

    it("refuses a preflight from anywhere else", async () => {
        const response = await worker.fetch(
            new Request("https://api.plinky.fun/v1/health", {
                method: "OPTIONS",
                headers: { origin: "https://plinky.fun.evil.test" },
            }),
            withEnv(),
        );

        expect(response.status).toBe(403);
        expect(response.headers.get("access-control-allow-origin")).toBeNull();
    });

    it("names no origin it was not asked about", async () => {
        const response = await get("/v1/health");

        expect(response.headers.get("access-control-allow-origin")).toBeNull();
        // The allowlist means nothing if a shared cache may hand one origin's response
        // to another.
        expect(response.headers.get("vary")).toBe("Origin");
    });

    it("echoes only an origin that is on the list", async () => {
        const allowed = await get("/v1/health", { origin: ORIGIN });
        const other = await get("/v1/health", { origin: "https://example.test" });

        expect(allowed.headers.get("access-control-allow-origin")).toBe(ORIGIN);
        expect(other.headers.get("access-control-allow-origin")).toBeNull();
    });

    it("allows nobody when no origin is configured", () => {
        expect(corsConfig({}).allowedOrigins).toEqual([]);
    });

    it("reads a comma-separated list, ignoring the spaces around it", () => {
        expect(corsConfig({ ALLOWED_ORIGINS: " a , ,b " }).allowedOrigins).toEqual(["a", "b"]);
    });
});

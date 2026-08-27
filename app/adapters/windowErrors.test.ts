// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { windowErrors } from "./windowErrors";

// jsdom rather than a real browser, for a reason particular to this adapter: the events
// it listens for are the ones a test runner watches to decide a test has failed. Raising
// a genuine unhandled rejection in the browser project fails the file no matter what the
// assertions say. jsdom dispatches the same event shapes without them reaching the
// runner, so the mapping — which of message and stack wins, how a non-Error reason
// reads, that teardown detaches — is pinned here. What is left unproven is only that a
// browser emits these events at all, which is the platform's contract rather than ours.

let stop: (() => void) | null = null;
afterEach(() => {
    stop?.();
    stop = null;
});

function collect() {
    const seen: { message: string; where: string }[] = [];
    stop = windowErrors.subscribe((fault) => seen.push(fault));
    return seen;
}

describe("windowErrors", () => {
    it("hears a throw that reached the window, and prefers the stack", () => {
        const seen = collect();

        window.dispatchEvent(
            new ErrorEvent("error", { message: "summary", error: new Error("boom") }),
        );

        expect(seen).toHaveLength(1);
        // The stack names where; the browser's summary does not.
        expect(seen[0]?.message).toContain("boom");
        expect(seen[0]?.where).toBe(window.location.pathname);
    });

    it("falls back to the browser's summary when there is no error object", () => {
        // A cross-origin script gives no error object and the message "Script error.".
        // Knowing something failed is worth more than knowing nothing.
        const seen = collect();

        window.dispatchEvent(new ErrorEvent("error", { message: "Script error." }));

        expect(seen[0]?.message).toBe("Script error.");
    });

    it("hears a promise nobody caught, and marks it as one", () => {
        // The likelier shape here: most of what this app does off the render path is a
        // fetch, a decode or an audio graph, and all of them are promises.
        const seen = collect();

        window.dispatchEvent(
            new PromiseRejectionEvent("unhandledrejection", {
                promise: Promise.resolve(),
                reason: new Error("no catch"),
            }),
        );

        expect(seen[0]?.message).toContain("no catch");
        expect(seen[0]?.message.startsWith("Unhandled rejection:")).toBe(true);
    });

    it("describes a rejection that is not an Error at all", () => {
        const seen = collect();

        window.dispatchEvent(
            new PromiseRejectionEvent("unhandledrejection", {
                promise: Promise.resolve(),
                reason: { code: 42 },
            }),
        );

        expect(seen[0]?.message).toBe("Unhandled rejection: [object Object]");
    });

    it("stops listening once torn down", () => {
        const seen = collect();
        stop?.();
        stop = null;

        window.dispatchEvent(new ErrorEvent("error", { message: "after" }));

        expect(seen).toHaveLength(0);
    });
});

// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { describeError, issueUrl } from "./errorReport";

// The shape the router throws for a failed route: isRouteErrorResponse
// recognises it structurally (status, statusText, internal, data).
const routeError = (status: number, statusText: string) => ({
    status,
    statusText,
    internal: false,
    data: null,
});

describe("describeError", () => {
    it("recognises a 404 route response as a missing page", () => {
        const report = describeError(routeError(404, "Not Found"));
        expect(report.notFound).toBe(true);
        expect(report.technical).toBe("404 Not Found");
    });

    it("keeps other route responses as plain errors", () => {
        const report = describeError(routeError(500, "Internal Server Error"));
        expect(report.notFound).toBe(false);
        expect(report.technical).toBe("500 Internal Server Error");
    });

    it("carries an Error's message and stack", () => {
        const error = new Error("boom");
        const report = describeError(error);
        expect(report.notFound).toBe(false);
        expect(report.technical.startsWith("boom")).toBe(true);
        expect(report.technical).toContain(error.stack ?? "");
    });

    it("handles an Error without a stack", () => {
        const error = new Error("bare");
        error.stack = undefined;
        expect(describeError(error).technical).toBe("bare");
    });

    it("stringifies a thrown non-Error value", () => {
        expect(describeError("just a string").technical).toBe("just a string");
        expect(describeError(42).technical).toBe("42");
        expect(describeError(undefined).technical).toBe("undefined");
    });
});

describe("issueUrl", () => {
    const BASE = "https://example.test/issues/new";

    it("titles a missing page as such and carries page + browser in the body", () => {
        const url = new URL(
            issueUrl(
                BASE,
                describeError(routeError(404, "Not Found")),
                "https://plinky.fun/xyz",
                "TestUA/1.0",
            ),
        );
        expect(url.origin + url.pathname).toBe(BASE);
        expect(url.searchParams.get("title")).toBe("Page not found");
        const body = url.searchParams.get("body") ?? "";
        expect(body).toContain("**Page:** https://plinky.fun/xyz");
        expect(body).toContain("**Browser:** TestUA/1.0");
        expect(body).toContain("404 Not Found");
    });

    it("titles a crash with the first line of the technical detail only", () => {
        const url = new URL(
            issueUrl(BASE, describeError(new Error("boom")), "https://plinky.fun/", "UA"),
        );
        expect(url.searchParams.get("title")).toBe("Error: boom");
        // The multi-line stack stays in the body, not the title.
        expect(url.searchParams.get("body")).toContain("at ");
    });
});

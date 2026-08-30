// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { onRequest } from "./_middleware.js";

// The asset server's answer, which is all the middleware ever sees.
function served(status: number, body: string | null, headers: Record<string, string> = {}) {
    return { next: async () => new Response(body, { status, headers }) };
}

// 204 and 304 carry no body at all, which the Response constructor enforces.
const BODILESS = new Set([204, 304]);

describe("onRequest", () => {
    it("turns the shell's 404 into a 200 without touching the page", async () => {
        const response = await onRequest(
            served(404, "<!doctype html>shell", { "content-type": "text/html" }),
        );

        expect(response.status).toBe(200);
        expect(await response.text()).toBe("<!doctype html>shell");
        expect(response.headers.get("content-type")).toBe("text/html");
    });

    it("passes a prerendered document straight through", async () => {
        // The pieces and composers that do prerender must keep their own document, with
        // their own title and structured data — rewriting those would trade one SEO bug
        // for a worse one.
        const response = await onRequest(served(200, "<!doctype html>Ode to Joy"));

        expect(response.status).toBe(200);
        expect(await response.text()).toBe("<!doctype html>Ode to Joy");
    });

    it("leaves every other status alone", async () => {
        for (const status of [204, 301, 304, 308, 403, 500]) {
            const body = BODILESS.has(status) ? null : "";
            expect((await onRequest(served(status, body))).status).toBe(status);
        }
    });
});

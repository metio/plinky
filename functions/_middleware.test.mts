// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it } from "vitest";
import { forgetKnown, onRequest } from "./_middleware.js";

// The known-address list the build writes beside the site, as the asset binding serves it.
const KNOWN = { pieces: ["47xd2XDpYFCy", "aZSWdZeRKnuA"], people: ["frederic-chopin"] };

// The asset server's answer for the request, which is all the middleware ever sees, over
// an asset binding that holds the known list (or, when `listStatus` says so, does not).
function served(
    path: string,
    status: number,
    body: string | null,
    headers: Record<string, string> = {},
    listStatus = 200,
) {
    return {
        request: new Request(`https://plinky.fun${path}`),
        next: async () => new Response(body, { status, headers }),
        env: {
            ASSETS: {
                fetch: async (request: Request | URL | string) => {
                    const url = new URL(typeof request === "string" ? request : request.toString());
                    if (url.pathname === "/known.json" && listStatus === 200) {
                        return new Response(JSON.stringify(KNOWN), { status: 200 });
                    }
                    return new Response("not found", { status: listStatus === 200 ? 404 : listStatus });
                },
            },
        },
    };
}

// 204 and 304 carry no body at all, which the Response constructor enforces.
const BODILESS = new Set([204, 304]);

beforeEach(() => {
    forgetKnown();
});

describe("onRequest", () => {
    it("turns the shell's 404 into a 200 for a piece the catalogue holds", async () => {
        const response = await onRequest(
            served("/en/play/47xd2XDpYFCy/", 404, "<!doctype html>shell", {
                "content-type": "text/html",
            }),
        );

        expect(response.status).toBe(200);
        expect(await response.text()).toBe("<!doctype html>shell");
        expect(response.headers.get("content-type")).toBe("text/html");
    });

    it("keeps the 404 for a piece the catalogue does not hold", async () => {
        // An id from a scheme the catalogue left behind: the address is gone, and a 200
        // with an empty shell would be a soft 404 in a search index.
        for (const path of [
            "/en/play/study-QmSXYCbTLLAFvAqMoKhiUbZgozYYXHoee6DcLXkLY8L8vd/",
            "/de/play/twinkle-twinkle",
            "/fi/person/lemoine-y-carulli",
        ]) {
            expect((await onRequest(served(path, 404, "shell"))).status).toBe(404);
        }
    });

    it("answers a composer the site has, in any language", async () => {
        expect((await onRequest(served("/ja/person/frederic-chopin/", 404, "shell"))).status).toBe(
            200,
        );
    });

    it("needs no list for a generated exercise, which is built from its id", async () => {
        const response = await onRequest(
            served("/en/play/chords-c-major.1bi2/", 404, "shell", {}, 500),
        );
        expect(response.status).toBe(200);
    });

    it("presumes every page real when the list cannot be read", async () => {
        // Losing the whole catalogue because one file failed to load would be the worse
        // fault; the old behaviour is the fallback.
        const response = await onRequest(served("/en/play/twinkle-twinkle/", 404, "shell", {}, 500));
        expect(response.status).toBe(200);
    });

    it("passes a prerendered document straight through", async () => {
        // The pieces and composers that do prerender must keep their own document, with
        // their own title and structured data — rewriting those would trade one SEO bug
        // for a worse one.
        const response = await onRequest(
            served("/en/play/aZSWdZeRKnuA/", 200, "<!doctype html>Ode to Joy"),
        );

        expect(response.status).toBe(200);
        expect(await response.text()).toBe("<!doctype html>Ode to Joy");
    });

    it("leaves every other status alone", async () => {
        for (const status of [204, 301, 304, 308, 403, 500]) {
            const body = BODILESS.has(status) ? null : "";
            expect((await onRequest(served("/en/play/47xd2XDpYFCy/", status, body))).status).toBe(
                status,
            );
        }
    });

    it("corrects a miss on any other route it is handed, as before", async () => {
        expect((await onRequest(served("/en/music/", 404, "shell"))).status).toBe(200);
    });
});

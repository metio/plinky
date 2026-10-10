// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The one shape every response takes, so a client can tell a transport failure from
// an application refusal. A fetch that throws, a 502 carrying Cloudflare's own HTML
// error page and a body that is not JSON all look alike from the browser; an
// envelope is what makes "the server said no" distinguishable from "the server was
// not there", and only the first is worth telling a player about.
//
// The version is on the wire rather than in the URL because it describes the
// envelope, not the endpoint: a client that does not recognise `v` should stop
// reading rather than guess at the fields inside.

export const ENVELOPE_VERSION = 1;

// A closed set, and stable wire contract. A client maps anything it does not
// recognise to the same behaviour as `internal`, so adding a code here is not a
// breaking change — which is the property that lets this list grow.
export type ErrorCode =
    | "bad_request"
    | "unauthorized"
    | "not_found"
    | "rate_limited"
    | "too_large"
    | "disabled"
    | "internal";

export type Envelope<T> =
    | { v: number; ok: true; data: T }
    | { v: number; ok: false; error: ErrorCode; retryAfter?: number };

const STATUS: Record<ErrorCode, number> = {
    bad_request: 400,
    unauthorized: 401,
    not_found: 404,
    rate_limited: 429,
    too_large: 413,
    disabled: 503,
    internal: 500,
};

// How long a response may be reused. Answered per call rather than defaulted,
// because the wrong value is silent in both directions: a cached error is an outage
// that outlives its cause, and an uncached read is a bill.
export type Caching = { maxAgeSeconds: number } | "no-store";

function cacheHeader(caching: Caching): string {
    return caching === "no-store" ? "no-store" : `public, max-age=${caching.maxAgeSeconds}`;
}

export function ok<T>(data: T, caching: Caching = "no-store"): Response {
    return json({ v: ENVELOPE_VERSION, ok: true, data }, 200, caching);
}

export function fail(error: ErrorCode, retryAfter?: number): Response {
    const body: Envelope<never> = { v: ENVELOPE_VERSION, ok: false, error };
    const response = json(
        retryAfter === undefined ? body : { ...body, retryAfter },
        STATUS[error],
        "no-store",
    );
    if (retryAfter !== undefined) {
        response.headers.set("retry-after", String(retryAfter));
    }
    return response;
}

function json(body: unknown, status: number, caching: Caching): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": cacheHeader(caching),
            // Nothing here is ever a document, and a JSON body a browser is willing to
            // sniff as HTML is a JSON body that can carry script.
            "x-content-type-options": "nosniff",
        },
    });
}

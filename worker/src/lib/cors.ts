// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Which origins may call the API, and what a preflight costs.
//
// The API answers on its own subdomain, so every browser call that carries a header
// is preceded by an OPTIONS the origin also pays for. `Access-Control-Max-Age` is
// what keeps that from doubling the request count: a browser that remembers the
// answer for a day asks once per day rather than once per call.
//
// The allowlist is explicit and never `*`. Requests here carry capability tokens,
// and a wildcard on a token-bearing endpoint means any page anybody visits can
// spend one.

// Origins are configured rather than compiled in, because the preview deploys get a
// per-branch origin that no build can know.
export type CorsConfig = { allowedOrigins: readonly string[] };

// A day. The ceiling browsers actually honour is lower than the header allows —
// Chrome caps a preflight at two hours — so this asks for what is useful and lets
// each browser keep less.
const MAX_AGE_SECONDS = 86_400;

export function allowedOrigin(request: Request, config: CorsConfig): string | null {
    const origin = request.headers.get("origin");
    if (origin === null) {
        return null;
    }
    // Compared whole, never by prefix or suffix. `plinky.fun.example.com` ends with
    // nothing this list holds, but `startsWith("https://plinky.fun")` would admit
    // `https://plinky.fun.evil.test`.
    return config.allowedOrigins.includes(origin) ? origin : null;
}

// The headers a real response carries. `Vary: Origin` is not decoration: without it
// a cache that saw one origin's response may hand it to another, and the allowlist
// stops meaning anything.
export function corsHeaders(origin: string | null): Record<string, string> {
    return origin === null
        ? { vary: "Origin" }
        : { "access-control-allow-origin": origin, vary: "Origin" };
}

// The answer to a preflight. A request from an origin not on the list gets a plain
// refusal rather than a permissive answer with the headers left off — the browser
// blocks either way, and the explicit form is the one that reads correctly in a log.
export function preflight(request: Request, config: CorsConfig): Response {
    const origin = allowedOrigin(request, config);
    if (origin === null) {
        return new Response(null, { status: 403 });
    }
    return new Response(null, {
        status: 204,
        headers: {
            ...corsHeaders(origin),
            "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
            "access-control-allow-headers": "authorization, content-type",
            "access-control-max-age": String(MAX_AGE_SECONDS),
        },
    });
}

export function withCors(response: Response, origin: string | null): Response {
    for (const [name, value] of Object.entries(corsHeaders(origin))) {
        response.headers.set(name, value);
    }
    return response;
}

// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { allowedOrigin, type CorsConfig, preflight, withCors } from "./lib/cors";
import { fail } from "./lib/envelope";
import { health } from "./routes/health";

// The whole API surface. Plinky works with no server at all, so everything here is
// additive by construction: a capability that is off, unreachable or never deployed
// leaves the app exactly as it is.
//
// A handler receives what it needs as arguments. Nothing reads a binding from module
// scope, for the same reason no component reaches for a singleton — a test supplies
// the environment, and a handler that cannot be given one cannot be tested without
// standing up the world it assumes.

export type Env = {
    // Comma-separated, because a preview deploy adds an origin the build cannot know.
    ALLOWED_ORIGINS?: string;
    FEATURE_RESULTS?: string;
    FEATURE_SUBMISSIONS?: string;
    FEATURE_DAILY?: string;
    FEATURE_VAULT?: string;
};

export function corsConfig(env: Env): CorsConfig {
    return {
        allowedOrigins: (env.ALLOWED_ORIGINS ?? "")
            .split(",")
            .map((origin) => origin.trim())
            .filter((origin) => origin.length > 0),
    };
}

function route(request: Request, env: Env): Response {
    const { pathname } = new URL(request.url);
    if (pathname === "/v1/health") {
        // A read, so GET and HEAD both; anything else is the wrong verb rather than a
        // missing route, and saying so saves a caller guessing at the path.
        return request.method === "GET" || request.method === "HEAD"
            ? health(env)
            : fail("bad_request");
    }
    // Not 404-with-detail: a scanner should learn nothing from the shape of a refusal
    // beyond the fact that there is nothing here.
    return fail("not_found");
}

export default {
    fetch(request: Request, env: Env): Response {
        const config = corsConfig(env);
        if (request.method === "OPTIONS") {
            return preflight(request, config);
        }
        const origin = allowedOrigin(request, config);
        try {
            return withCors(route(request, env), origin);
        } catch {
            // The body a handler throws is never a body a caller sees. An unhandled
            // error is `internal` and nothing else — a stack trace on the wire tells an
            // attacker what is installed and tells a player nothing at all.
            return withCors(fail("internal"), origin);
        }
    },
};

// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { type Caching, ok } from "../lib/envelope";

// What the client asks before it offers anything. Each capability checks its own
// flag, so turning one off is a setting on the Worker rather than a redeploy of the
// site — and a capability nobody can reach is one that cannot spend the day's
// request allowance.
//
// Unknown means off. A client that cannot read this answer offers nothing, which is
// the same state as a build with no API configured at all, so the failure of this
// endpoint costs a capability rather than breaking a screen.

export type Flags = {
    results: boolean;
    submissions: boolean;
    daily: boolean;
    vault: boolean;
};

// Everything off. Phase 0 builds the pipeline and nothing that runs through it, so
// a flag that answered true would be advertising an endpoint that returns 404.
const NONE: Flags = { results: false, submissions: false, daily: false, vault: false };

// A minute. Long enough that a page load costs no request of its own, short enough
// that turning a capability off takes effect while somebody is still watching the
// dashboard. The kill switch is only as fast as this number.
export const HEALTH_CACHING: Caching = { maxAgeSeconds: 60 };

// A flag is on when its variable says exactly "on". Anything else — absent, empty,
// misspelt, "true", "1" — leaves it off, because a typo in a setting should fail
// towards the state that costs nothing rather than towards the one that bills.
export function flagsFrom(env: Record<string, unknown>): Flags {
    const on = (name: keyof Flags) => env[`FEATURE_${name.toUpperCase()}`] === "on";
    return {
        results: on("results"),
        submissions: on("submissions"),
        daily: on("daily"),
        vault: on("vault"),
    };
}

export function health(env: Record<string, unknown>): Response {
    return ok({ flags: { ...NONE, ...flagsFrom(env) } }, HEALTH_CACHING);
}

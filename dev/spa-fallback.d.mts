// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Types for dev/spa-fallback.mjs, which stays plain JavaScript because the deploy runs it
// through plain Node with nothing installed.

export const ROUTE_RULE_LIMIT: number;

export type RouteRules = {
    version: 1;
    include: string[];
    exclude: string[];
};

export function routeRules(locales: string[], prefixes: string[]): RouteRules;
export function writeSpaFallback(out?: string): {
    locales: string[];
    prefixes: string[];
    rules: number;
};

// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The first segment of every page under /:locale/, so an address with no language in it
// can be told from one whose language is mistyped. dev/pages.test.mts holds this list to
// the route table, so a page added to app/routes.ts and missed here fails a gate.
export const PAGE_NAMES: ReadonlySet<string> = new Set([
    "play",
    "piano",
    "compose",
    "daily",
    "ear",
    "rhythm",
    "music",
    "assignments",
    "collect",
    "stats",
    "placement",
    "review",
    "settings",
    "learn",
    "teach",
    "basics",
    "help",
    "glossary",
    "tools",
    "theory",
    "about",
    "news",
    "impressum",
    "datenschutz",
    "person",
]);

// The path to put under a real language, given a pathname whose first segment is not one.
//
// A first segment that names a page means the address arrived with no language at all —
// "/music/", or "/glossary/piano/", which the router matches as ":locale/piano" because a
// dynamic segment followed by a static one outranks the catch-all. The whole path is the
// page asked for, so it is kept whole: dropping "glossary" would answer a question about
// the mark "piano" with the free-play keyboard.
//
// Otherwise the first segment is a mistyped language — "/zz/play/abc" — and the page after
// it is recoverable by dropping it. A lone segment is kept all the same, so a bare "/zz"
// reaches the not-found page instead of being sent quietly to the home page.
export function unlocalizedPath(pathname: string): string {
    const first = pathname.split("/")[1] ?? "";
    const rest = pathname.slice(first.length + 1);
    const lone = rest === "" || rest === "/";
    return lone || PAGE_NAMES.has(first) ? pathname : rest;
}

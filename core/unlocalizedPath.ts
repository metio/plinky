// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A segment written the way a language is: two letters, with an optional region or script
// after a hyphen or underscore — "de", "DE", "en-US", "pt_BR", "sr-Latn". Every locale Plinky
// ships has this shape and no page's first segment does; dev/pages.test.mts holds both to it.
export const LANGUAGE_SHAPED = /^[a-z]{2}(?:[-_][a-z]{2,4})?$/i;

// The path to put under a real language, given a pathname whose first segment is not one.
//
// A language-shaped first segment is a mistyped language — "/zz/play/abc", "/EN/music/" —
// and the page after it is recoverable by dropping it.
//
// Any other first segment means the address arrived with no language at all — "/music/",
// or "/glossary/piano/", which the router matches as ":locale/piano" because a dynamic
// segment followed by a static one outranks the catch-all. The whole path is the page asked
// for, so it is kept whole: dropping "glossary" would answer a question about the mark
// "piano" with the free-play keyboard. A first segment that is neither a page nor
// language-shaped — "/english/music/" — is kept too, and reaches the not-found page.
//
// A lone segment is kept all the same, so a bare "/zz" reaches the not-found page instead
// of being sent quietly to the home page.
export function unlocalizedPath(pathname: string): string {
    const first = pathname.split("/")[1] ?? "";
    const rest = pathname.slice(first.length + 1);
    const lone = rest === "" || rest === "/";
    return lone || !LANGUAGE_SHAPED.test(first) ? pathname : rest;
}

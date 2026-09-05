// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The one guard around JSON.parse. Malformed input is a normal condition — a stored value
// from an older build, a file somebody edited, a paste — never a throw to catch at each
// call site, so every reader of JSON in core and the stores goes through here.

// What jsonOf hands back for input that is not JSON at all, as distinct from any value
// JSON can carry — null included.
export const NOT_JSON: unique symbol = Symbol("not JSON");

// The value a JSON text carries, or NOT_JSON when it carries none. For a reader that
// tells a broken file apart from a well-formed one of the wrong shape.
export function jsonOf(json: string): unknown | typeof NOT_JSON {
    try {
        return JSON.parse(json);
    } catch {
        return NOT_JSON;
    }
}

// The defensive half of a stored value's parse: absent or corrupt raw data reads as the
// fallback, and only valid JSON reaches `coerce` — so a parser only has to shape a
// successfully parsed value, not guard the parsing. A coerce that throws on a shape it
// cannot read lands on the fallback too.
export function parseJson<T>(raw: string | null, fallback: T, coerce: (parsed: unknown) => T): T {
    if (raw === null) {
        return fallback;
    }
    try {
        return coerce(JSON.parse(raw));
    } catch {
        return fallback;
    }
}

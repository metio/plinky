// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reading a string-keyed table safely.
//
// A plain object answers for every name on Object's prototype, so `TABLE[key] ?? fallback`
// hands back a function for "constructor", "toString", "valueOf" and half a dozen others
// — never the fallback, because a function is neither null nor undefined. The keys that
// trigger it are not exotic: they arrive as a locale in a path segment, a <step> in an
// imported MusicXML file, a licence in a restored backup. What follows is worse than a
// crash, because it is silent: `12 + Object.prototype.constructor` is the string
// "12function Object() { [native code] }", so a function reaches code that declared a
// number and the type system never notices.
//
// Every table read here goes through this, so the guard is one seam with one test rather
// than a rule each call site has to remember.

// Whether the table itself holds this key — not whether indexing it yields something.
export function known<T>(table: Record<string, T>, key: string): boolean {
    return Object.hasOwn(table, key);
}

// The table's value for `key`, or `fallback` when the table does not hold it.
export function lookup<T>(table: Record<string, T>, key: string, fallback: T): T {
    return Object.hasOwn(table, key) ? (table[key] as T) : fallback;
}

// The table's value for `key`, or null — for a caller that tells "not in the table"
// apart from a value of its own.
export function lookupOr<T>(table: Record<string, T>, key: string): T | null {
    return Object.hasOwn(table, key) ? (table[key] as T) : null;
}

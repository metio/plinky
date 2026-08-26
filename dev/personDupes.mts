// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Finding the composer pages that might be one person, and holding that answer against the
// pairs somebody has already ruled on.
//
// The analysis lives here rather than in the script that prints it, so it can be tested
// without a catalogue: dev/person-dupes.mts reads the manifests, formats and exits, which
// is all a gate's shell should do.
//
// Four tests, because one person splits in four different ways: the same surname under two
// first names, one name contained in another, a surname that differs only by accent or
// transliteration, and a plain misspelling.

import { canonicalPeople, personSlug } from "../core/person";

export type Pair = { a: string; b: string; why: string };
export type Ruling = { a: string; b: string; why: string };

// Every person the catalogue credits, and how many pieces each holds. Reading every name in
// a credit rather than the first is what makes the count match the pages: a chorale melody
// and the setting of it is one piece and two composers.
export function creditedPeople(credits: readonly string[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const credit of credits) {
        // Once per person per credit. A credit naming one person under two spellings is
        // still one person, and counting them twice would invent a pair with themselves.
        const seen = new Set<string>();
        for (const name of canonicalPeople(credit)) {
            const slug = personSlug(name);
            if (!slug || seen.has(slug)) {
                continue;
            }
            seen.add(slug);
            counts.set(name, (counts.get(name) ?? 0) + 1);
        }
    }
    return counts;
}

// Accents, case and punctuation folded away, so a transliteration compares to its original.
const fold = (text: string) =>
    text
        .normalize("NFD")
        .replace(/\p{Mn}/gu, "")
        .toLowerCase()
        .replace(/[^a-z\s]/g, "")
        .trim();
const words = (name: string) => fold(name).split(/\s+/).filter(Boolean);
const surname = (name: string) => words(name).at(-1) ?? "";

// Edit distance, capped: anything past two edits is a different name, and stopping early
// keeps the all-pairs walk cheap.
function within(a: string, b: string, max: number): boolean {
    if (Math.abs(a.length - b.length) > max) {
        return false;
    }
    let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const row = [i];
        let best = i;
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            row[j] = Math.min(row[j - 1]! + 1, previous[j]! + 1, previous[j - 1]! + cost);
            best = Math.min(best, row[j]!);
        }
        if (best > max) {
            return false;
        }
        previous = row;
    }
    return previous[b.length]! <= max;
}

// The key a pair is identified by, in both directions at once: a ruling written the other
// way round is the same ruling, and nobody should have to guess the order.
export function pairKey(a: string, b: string): string {
    return [a, b].sort().join(" ↔ ");
}

export function candidatePairs(names: readonly string[]): Pair[] {
    const found: Pair[] = [];
    const seen = new Set<string>();
    const add = (a: string, b: string, why: string) => {
        const key = pairKey(a, b);
        if (seen.has(key)) {
            return;
        }
        seen.add(key);
        found.push({ a, b, why });
    };

    for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
            const a = names[i]!;
            const b = names[j]!;
            const sa = surname(a);
            const sb = surname(b);
            if (sa.length < 4 || sb.length < 4) {
                continue;
            }
            const wa = words(a);
            const wb = words(b);
            if (sa === sb) {
                // The same surname under two first names. Often two real people (a father
                // and a son, a husband and a wife), so this reports rather than decides.
                add(a, b, "same surname");
            } else if (within(sa, sb, 1)) {
                add(a, b, "surname differs by one letter");
            } else if (fold(a) !== fold(b) && within(fold(a), fold(b), 2)) {
                add(a, b, "whole name within two edits");
            }
            if (sa === sb) {
                continue;
            }
            const setA = new Set(wa);
            if (wb.length > 0 && wb.every((word) => setA.has(word))) {
                add(a, b, "one name is contained in the other");
            }
        }
    }
    return found;
}

// The two ways the file and the catalogue disagree. A pair nobody has ruled on is the
// gate's whole point. A ruling that matches no pair is the same failure read backwards:
// the catalogue has moved and the file describes composers who are no longer both in it,
// which is how a list of rulings quietly stops being about anything.
export function compare(
    pairs: readonly Pair[],
    rulings: readonly Ruling[],
): { unruled: Pair[]; unused: Ruling[] } {
    const ruled = new Set(rulings.map((one) => pairKey(one.a, one.b)));
    const candidates = new Set(pairs.map((one) => pairKey(one.a, one.b)));
    return {
        unruled: pairs.filter((one) => !ruled.has(pairKey(one.a, one.b))),
        unused: rulings.filter((one) => !candidates.has(pairKey(one.a, one.b))),
    };
}

// The rulings file, validated rather than trusted. A bare pair with no reason, a year
// later, is indistinguishable from somebody silencing the gate — the same argument
// dev/curation.mts makes about a bare id and a replacement string.
export function parseRulings(raw: unknown): { rulings: Ruling[]; problems: string[] } {
    const problems: string[] = [];
    if (!Array.isArray(raw)) {
        return { rulings: [], problems: ["the file must hold a list of rulings"] };
    }
    const rulings: Ruling[] = [];
    const seen = new Set<string>();
    for (const [at, entry] of raw.entries()) {
        const where = `entry ${at + 1}`;
        if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
            problems.push(`${where}: must be an object`);
            continue;
        }
        const { a, b, why, ...rest } = entry as Record<string, unknown>;
        const extra = Object.keys(rest);
        if (extra.length > 0) {
            problems.push(`${where}: unknown field(s) ${extra.join(", ")}`);
        }
        if (typeof a !== "string" || a.trim() === "" || typeof b !== "string" || b.trim() === "") {
            problems.push(`${where}: needs both names`);
            continue;
        }
        if (typeof why !== "string" || why.trim() === "") {
            problems.push(`${a} / ${b}: needs a "why" saying how we know they are two people`);
            continue;
        }
        const key = pairKey(a, b);
        if (seen.has(key)) {
            problems.push(`${a} / ${b}: ruled on twice`);
            continue;
        }
        seen.add(key);
        rulings.push({ a, b, why });
    }
    return { rulings, problems };
}

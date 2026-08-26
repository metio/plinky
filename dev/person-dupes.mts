// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Every pair of composer pages that might be one person, so the alias table can be checked
// against the whole catalogue rather than against whichever names somebody happened to
// scroll past. Reports candidates for a human to rule on — it never merges anything.
//
// Four tests, because one person splits in four different ways: the same surname under two
// first names, one name contained in another, a surname that differs only by accent or
// transliteration, and a plain misspelling.

import { readFileSync } from "node:fs";
import { canonicalPeople, personSlug } from "../core/person";

const songs = JSON.parse(readFileSync("public/songs/manifest.json", "utf8"));
const items = Array.isArray(songs) ? songs : songs.items;

const counts = new Map<string, number>();
for (const it of items) {
    // Every person the credit names, the same way the pages are built. Reading one name per
    // credit made the report describe a catalogue that no longer exists: a joint credit
    // counted as a page of its own, so "Gesius / Telemann" showed up beside Telemann as a
    // pair to consider merging, when the pair is exactly what the split had already removed.
    for (const canon of canonicalPeople(it.composer ?? "")) {
        if (!personSlug(canon)) continue;
        counts.set(canon, (counts.get(canon) ?? 0) + 1);
    }
}
const names = [...counts.keys()];

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
    if (Math.abs(a.length - b.length) > max) return false;
    let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const row = [i];
        let best = i;
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            row[j] = Math.min(row[j - 1]! + 1, previous[j]! + 1, previous[j - 1]! + cost);
            best = Math.min(best, row[j]!);
        }
        if (best > max) return false;
        previous = row;
    }
    return previous[b.length]! <= max;
}

type Pair = { a: string; b: string; why: string };
const found: Pair[] = [];
const seen = new Set<string>();
const add = (a: string, b: string, why: string) => {
    const key = [a, b].sort().join(" ");
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ a, b, why });
};

for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
        const a = names[i]!;
        const b = names[j]!;
        const sa = surname(a);
        const sb = surname(b);
        if (sa.length < 4 || sb.length < 4) continue;
        const wa = words(a);
        const wb = words(b);
        if (sa === sb) {
            // The same surname under two first names. Often two real people (a father and
            // a son, a husband and a wife), so this reports rather than decides.
            add(a, b, "same surname");
        } else if (within(sa, sb, 1)) {
            add(a, b, "surname differs by one letter");
        } else if (fold(a) !== fold(b) && within(fold(a), fold(b), 2)) {
            add(a, b, "whole name within two edits");
        }
        if (sa === sb) continue;
        const setA = new Set(wa);
        if (wb.length > 0 && wb.every((word) => setA.has(word))) {
            add(a, b, "one name is contained in the other");
        }
    }
}

console.log(`${names.length} composer pages, ${found.length} candidate pairs\n`);
for (const { a, b, why } of found.sort((x, y) => x.why.localeCompare(y.why))) {
    console.log(`  [${why}]  ${a} (${counts.get(a)})  <->  ${b} (${counts.get(b)})`);
}

// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Resolves the named works in dev/builtin-assignments.json to the piece ids the catalogue
// actually holds, and ships the result as public/songs/builtin-assignments.json.
//
// A pianist works through a book, not a piece: the two-part inventions, Burgmüller's
// studies, the Goldberg variations. Those sets already exist inside the catalogue but are
// invisible in it — three thousand rows sorted by difficulty, with no sign that fifteen of
// them are one work. Naming them costs nothing new to learn, because Plinky already has
// the thing they become: an assignment.
//
// Resolved here rather than in the browser so no pattern-matching table reaches a
// visitor's bundle, and so a set that has stopped resolving fails a gate instead of
// rendering as an empty card. Derived, never hand-edited. Run through `npm run songs:bake`;
// `--check` is the CI guard.

import { readFile, writeFile } from "node:fs/promises";
import type { SongMeta } from "../core/catalogMeta.ts";
import { readSongs } from "./manifest.mts";
import { matchWork } from "./works.mts";

const DEFINITIONS = "dev/builtin-assignments.json";
const OUT = "public/songs/builtin-assignments.json";

export type Definition = {
    id: string;
    name: string;
    composer: string;
    title: string;
    // How few pieces the catalogue may hold before this stops being the work it names.
    least: number;
};

// What resolving a definition reads off a catalogue row.
export type Song = Pick<SongMeta, "id" | "title" | "composer" | "cost" | "scoreKind">;
// What ships: a name and its pieces, gentlest first, so working through a set is also
// working up through it.
export type BuiltinAssignment = { id: string; name: string; items: string[] };

// Which pieces each definition names, and what has stopped resolving. Pure, so the rule
// can be tested without a catalogue on disk.
export function resolveSets(
    definitions: Definition[],
    songs: Song[],
): { sets: BuiltinAssignment[]; problems: string[] } {
    // Only what a pianist plays alone. A set is something to work through at the keyboard,
    // and an art song's piano part is not that even when its composer wrote the book.
    const resolved: (BuiltinAssignment & { level: number })[] = [];
    const problems: string[] = [];
    for (const definition of definitions) {
        const members = matchWork(songs, definition).sort((a, b) => a.cost - b.cost);
        if (members.length < definition.least) {
            problems.push(
                `${definition.name} resolves to ${members.length} pieces, fewer than the ${definition.least} it needs`,
            );
            continue;
        }
        resolved.push({
            id: definition.id,
            name: definition.name,
            items: members.map((song) => song.id),
            // What the set as a whole asks for. Its median rather than its easiest piece:
            // one badly parsed score is enough to give a book of études a trivial cheapest
            // member, and sorting on that put the Well-Tempered Clavier second.
            level: members[members.length >> 1]?.cost ?? 0,
        });
    }
    // Gentlest set first, so a beginner meets Czerny's eight-bar exercises before the
    // Chopin études rather than scrolling past them. Derived from what the pieces measure
    // rather than from the order the definitions happen to be written in.
    resolved.sort((a, b) => a.level - b.level);
    return {
        sets: resolved.map(({ level: _level, ...set }) => set),
        problems,
    };
}

async function resolveBuiltinAssignments(): Promise<{
    sets: BuiltinAssignment[];
    problems: string[];
}> {
    const { sets }: { sets: Definition[] } = JSON.parse(await readFile(DEFINITIONS, "utf8"));
    return resolveSets(sets, await readSongs());
}

// Writes the resolved sets, or with `check` reports whether what is on disk matches.
export async function bakeBuiltinAssignments(check: boolean): Promise<boolean> {
    const { sets, problems } = await resolveBuiltinAssignments();
    if (problems.length > 0) {
        console.error("Built-in assignments no longer resolve against the catalogue:");
        for (const problem of problems) {
            console.error(`  • ${problem}`);
        }
        console.error(
            "\nEither the catalogue lost pieces, or the pattern in dev/builtin-assignments.json",
        );
        console.error("stopped matching how they are titled.");
        return false;
    }
    const baked = JSON.stringify(sets);
    if (check) {
        const current = await readFile(OUT, "utf8").catch(() => "");
        if (current !== baked) {
            console.error(`${OUT} is stale.`);
            return false;
        }
        console.log(`Built-in assignments are baked: ${sets.length} sets.`);
        return true;
    }
    await writeFile(OUT, baked);
    const pieces = sets.reduce((total, set) => total + set.items.length, 0);
    console.log(`Built-in assignments: ${sets.length} sets over ${pieces} pieces.`);
    return true;
}

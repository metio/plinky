// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Writes the song manifest out a second time, in slices, so opening one piece does not
// download the whole catalogue.
//
// The full manifest stays exactly as it is — the pages that browse the catalogue want all
// of it, and one file is the right shape for that. What it was ALSO doing was standing on
// the critical path of every piece's page: `resolve(id)` needs one row of metadata to know
// where the notation lives, and six hundred kilobytes arrived first. Measured on a
// throttled connection that is most of a second before a note can be engraved.
//
// Derived, never edited: `npm run songs:bake` writes these from the manifest it just baked,
// and its `--check` mode fails if they disagree with it. A slice that drifted from the
// manifest would answer an old grade or a retired licence directory for the piece it holds.

import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { SHARD_COUNT, shardOf } from "../core/catalogShard.ts";

const DIR = "public/songs/index";

type Row = { id: string };

// The slices a manifest becomes, keyed by file name. Every slice is written, including the
// empty ones: a missing file is indistinguishable from a failed fetch at the other end, and
// the store would fall back to the whole manifest for a piece that simply has no neighbours.
function sliced(rows: readonly Row[]): Map<string, string> {
    const buckets = new Map<number, Row[]>();
    for (let bucket = 0; bucket < SHARD_COUNT; bucket++) {
        buckets.set(bucket, []);
    }
    for (const row of rows) {
        buckets.get(shardOf(row.id))?.push(row);
    }
    return new Map(
        [...buckets].map(([bucket, held]) => [
            `${String(bucket).padStart(2, "0")}.json`,
            JSON.stringify(held),
        ]),
    );
}

// Returns whether the slices on disk already match the manifest. In write mode it makes
// them match and returns true.
export async function bakeShards(check: boolean): Promise<boolean> {
    const manifest = JSON.parse(await readFile("public/songs/manifest.json", "utf8")) as Row[];
    const wanted = sliced(manifest);

    if (check) {
        const present = await readdir(DIR).catch(() => [] as string[]);
        if (present.length !== wanted.size) {
            return false;
        }
        for (const [name, body] of wanted) {
            const found = await readFile(`${DIR}/${name}`, "utf8").catch(() => null);
            if (found !== body) {
                return false;
            }
        }
        return true;
    }

    await mkdir(DIR, { recursive: true });
    // Clear first: a slice count that shrank would otherwise leave a stale file behind,
    // holding pieces the catalogue no longer has.
    for (const name of await readdir(DIR).catch(() => [] as string[])) {
        if (!wanted.has(name)) {
            await rm(`${DIR}/${name}`);
        }
    }
    for (const [name, body] of wanted) {
        await writeFile(`${DIR}/${name}`, body);
    }
    return true;
}

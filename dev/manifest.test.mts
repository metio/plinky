// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { SongMeta } from "../core/catalogMeta.ts";
import {
    readSongs,
    readSongsSync,
    scoreFiles,
    scorePath,
    writeSongs,
    writeSongsSync,
} from "./manifest.mts";

const ROW: SongMeta = {
    id: "abc123",
    title: "Minuet",
    composer: "Bach",
    grade: 1,
    cost: 2.5,
    license: "CC0-1.0",
    tempo: 90,
    beatsPerBar: 3,
    bars: 16,
};

let dir = "";
afterEach(() => {
    if (dir) {
        rmSync(dir, { recursive: true, force: true });
        dir = "";
    }
});

describe("the song manifest", () => {
    it("round-trips its rows, minified", async () => {
        dir = mkdtempSync(join(tmpdir(), "plinky-manifest-"));
        const path = join(dir, "manifest.json");
        await writeSongs([ROW], path);
        expect(await readSongs(path)).toEqual([ROW]);
        writeSongsSync([ROW, { ...ROW, id: "def456" }], path);
        expect(readSongsSync(path).map((row) => row.id)).toEqual(["abc123", "def456"]);
        expect(readSongsSync(path)).toEqual(
            JSON.parse(JSON.stringify([ROW, { ...ROW, id: "def456" }])),
        );
    });

    it("refuses a file that is not a list of rows", () => {
        dir = mkdtempSync(join(tmpdir(), "plinky-manifest-"));
        const path = join(dir, "manifest.json");
        writeFileSync(path, "{}");
        expect(() => readSongsSync(path)).toThrow(/not a list/);
    });
});

describe("where a shipped score is", () => {
    it("looks under the licence bucket first, then under every other", () => {
        dir = mkdtempSync(join(tmpdir(), "plinky-songs-"));
        mkdirSync(join(dir, "cc0-1.0"));
        mkdirSync(join(dir, "cc-by-4.0"));
        mkdirSync(join(dir, "index"));
        writeFileSync(join(dir, "cc0-1.0", "abc.mxl"), "");
        writeFileSync(join(dir, "cc-by-4.0", "def.mxl"), "");
        expect(scorePath("abc", "CC0-1.0", dir)).toBe(`${dir}/cc0-1.0/abc.mxl`);
        // A row whose licence names the wrong bucket still finds its file.
        expect(scorePath("def", "CC0-1.0", dir)).toBe(`${dir}/cc-by-4.0/def.mxl`);
        expect(scorePath("def", undefined, dir)).toBe(`${dir}/cc-by-4.0/def.mxl`);
        expect(scorePath("ghi", "CC0-1.0", dir)).toBeNull();
        expect([...scoreFiles(dir).keys()].sort()).toEqual(["abc", "def"]);
    });
});

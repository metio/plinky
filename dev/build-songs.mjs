// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Bundles the per-song source files in songs/ into the registry pack served at
// /registry/starter.json. Each song is its own file so its license is tracked
// individually by REUSE; this step bundles them for the GitHub Pages deploy.
// Run from the repo root: node dev/build-songs.mjs
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

const dir = "songs";
const curriculums = JSON.parse(readFileSync(`${dir}/_curriculums.json`, "utf8"));
const songs = readdirSync(dir)
    .filter((name) => name.endsWith(".json") && !name.startsWith("_"))
    .sort()
    .map((name) => JSON.parse(readFileSync(`${dir}/${name}`, "utf8")));

const pack = { format: "plinky-songs", version: 1, curriculums, songs };
mkdirSync("public/registry", { recursive: true });
writeFileSync("public/registry/starter.json", `${JSON.stringify(pack, null, 2)}\n`);
console.log(`bundled ${songs.length} songs into public/registry/starter.json`);

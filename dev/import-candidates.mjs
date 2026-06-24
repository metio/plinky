// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Imports candidate public-domain songs (produced by the A–Z workflow) into the
// catalog: drops duplicates of what's already there, renders each ABC with the
// app's abcjs to confirm it actually plays, and writes a songs/<id>.json (CC0,
// public-domain curriculum) only for the ones that pass. Usage:
//   node dev/import-candidates.mjs <candidates.json>
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const candidatesPath = process.argv[2];
if (!candidatesPath) {
    console.error("usage: node dev/import-candidates.mjs <candidates.json>");
    process.exit(2);
}

const norm = (s) =>
    s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

// Existing catalog: collect ids and normalized titles so we never duplicate.
const existingIds = new Set();
const existingTitles = new Set();
for (const file of readdirSync("songs")) {
    if (!file.endsWith(".json") || file === "_curriculums.json") continue;
    const song = JSON.parse(readFileSync(join("songs", file), "utf8"));
    existingIds.add(song.id);
    existingTitles.add(norm(song.title));
}

const candidates = JSON.parse(readFileSync(candidatesPath, "utf8")).songs ?? [];

// Render once per ABC in a single headless session; count playable note events.
const browser = await chromium.launch();
const page = await browser.newPage();
await page.addScriptTag({ path: "node_modules/abcjs/dist/abcjs-basic-min.js" });

const written = [];
const skippedDup = [];
const failedPlay = [];
const seenId = new Set();
const seenTitle = new Set();

for (const c of candidates) {
    const id = String(c.id || "").trim();
    const title = String(c.title || "").trim();
    const abc = String(c.abc || "");
    const nt = norm(title);
    if (!id || !title || !abc) continue;
    if (
        existingIds.has(id) ||
        existingTitles.has(nt) ||
        seenId.has(id) ||
        seenTitle.has(nt)
    ) {
        skippedDup.push(`${c.letter || "?"} ${title}`);
        continue;
    }
    if (!/^X:/m.test(abc) || !/^K:/m.test(abc)) {
        failedPlay.push(`${title} (missing X:/K: header)`);
        continue;
    }
    const steps = await page.evaluate((source) => {
        const el = document.createElement("div");
        document.body.appendChild(el);
        try {
            const tune = window.ABCJS.renderAbc(el, source, {})[0];
            if (!tune) return 0;
            tune.setUpAudio({});
            const events = tune.setupEvents(0, 1000, 100);
            return events.filter(
                (e) => e.type === "event" && (e.midiPitches?.length ?? 0) > 0,
            ).length;
        } catch {
            return 0;
        }
    }, abc);
    if (steps === 0) {
        failedPlay.push(`${title} (no playable notes)`);
        continue;
    }
    seenId.add(id);
    seenTitle.add(nt);
    const beatsPerBar =
        Number.isInteger(c.beatsPerBar) && c.beatsPerBar > 0
            ? c.beatsPerBar
            : Number((abc.match(/^M:\s*(\d+)\s*\//m) || [])[1]) || 4;
    const composer = String(c.composer || "Traditional").trim();
    const reason = String(c.publicDomainReason || "").trim();
    const description =
        composer && composer.toLowerCase() !== "traditional"
            ? `${composer}.`
            : reason
              ? `${reason}.`.replace(/\.\.$/, ".")
              : "Traditional.";
    const song = {
        id,
        title,
        description,
        abc,
        tempo: Number.isInteger(c.tempo) && c.tempo > 0 ? c.tempo : 96,
        beatsPerBar,
        license: "CC0-1.0",
        curriculums: ["public-domain"],
    };
    writeFileSync(join("songs", `${id}.json`), `${JSON.stringify(song, null, 2)}\n`);
    written.push(`${title} (${steps} notes)`);
}

await browser.close();

console.log(`\n=== WRITTEN (${written.length}) ===`);
for (const w of written) console.log(`  + ${w}`);
console.log(`\n=== SKIPPED as duplicate (${skippedDup.length}) ===`);
for (const s of skippedDup) console.log(`  - ${s}`);
console.log(`\n=== FAILED playability (${failedPlay.length}) ===`);
for (const f of failedPlay) console.log(`  ✗ ${f}`);
console.log(`\nwritten=${written.length} dup=${skippedDup.length} failed=${failedPlay.length}`);

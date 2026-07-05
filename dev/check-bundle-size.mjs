// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Verifies the built client JavaScript stays within budget, so the bundle can't
// grow unnoticed. Run after `npm run build` (the CI build job and `npm run size`).
//
// Budgets are gzipped sizes and a ratchet: lower them as you trim; raise them
// deliberately when a feature genuinely needs the bytes. OpenSheetMusicDisplay is
// a large, pinned vendor dependency that is lazy-loaded only on score pages, so it
// is budgeted apart from our own code — that keeps an app-code regression visible
// instead of lost behind OSMD's bulk.

import { readdirSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const DIR = "build/client/assets";
const VENDOR = /opensheetmusicdisplay/;

// The client bundle a SINGLE visitor downloads: the fixed OSMD vendor chunk
// (~310 KB, pinned) plus our own code. CI measures a per-locale build
// (`PLINKY_LOCALE=en npm run build`), because the deploy ships one tree-shaken
// bundle per language (dev/build-locales.mjs) — a German visitor never downloads
// Korean. So this tracks real per-visitor weight, not the summed all-locales output.
const BUDGET_TOTAL_KB = 545;
// Headroom for the header badges, the on-staff ghost race, the localizable SEO meta
// strings, the landing page's playable keyboard, the drag-and-drop score import page,
// compose mode (capture → notation sketch → share, plus the on-demand MIDI and
// MusicXML import parsers), and the UI-design-review work — the shared Button /
// IconButton / SegmentedControl primitives, the persistent bottom-tab + header
// navigation, and the expanded in-house icon set; and the run-end milestone share
// cards (first S, grade-up, flawless run); and the safety/usability pass — the
// shared two-step ConfirmButton on destructive actions, the iframe print fallback,
// ear-training reveal/skip, and the mode deep-links; and saved takes per song (the
// list with score-driven replay, MIDI/MusicXML download, and ghost-from-takes); and
// the self-contained play-title actions (Print / Export / Mark-learned fed raw data
// + a transpose context); and the absolute-beginner onboarding — the home "New to
// piano?" front door, the note-name key labels with their Settings control and
// reactive store, and the mode / practice-loop coach marks; and the play-option
// captions that explain each practice-tool control and its values inline; and the
// click-to-select loop range with its red bar overlay (measure hit-testing + SVG
// backdrop rects); and the auto-full-screen play surface — the in-play restart /
// finger-numbers / follow-the-note toggles and their icons; and the per-hand share grid
// with its lagging-hand grade-panel readout; and the tempo-locked "keep up" play-along —
// the clock-driven runner, its hit/miss painting and result; and the ServicesProvider
// DI backbone (the injected-capabilities context every feature reads its integration
// points from) — whose entry-level import edge makes Rollup emit many small shared
// chunks (fflate and the storage helpers each on their own); the extra chunk
// boundaries cost ~3 KB of gzip, traded for finer caching granularity.
//
// This ratchet was ~560 KB while the app shipped one shared bundle carrying all 26
// languages to every visitor. Per-locale builds (dev/build-locales.mjs) tree-shake
// each bundle down to its own language, so a single visitor's app code dropped to
// ~216 KB — the budget follows. Keep it tight; a real regression trips this line.
const BUDGET_APP_KB = 235;

const chunks = readdirSync(DIR)
    .filter((name) => name.endsWith(".js"))
    .map((name) => ({ name, gz: gzipSync(readFileSync(`${DIR}/${name}`)).length }))
    .sort((a, b) => b.gz - a.gz);

const total = chunks.reduce((sum, chunk) => sum + chunk.gz, 0);
const vendor = chunks
    .filter((chunk) => VENDOR.test(chunk.name))
    .reduce((sum, chunk) => sum + chunk.gz, 0);
const app = total - vendor;
const kb = (bytes) => (bytes / 1024).toFixed(1);

console.log("Largest client chunks (gzipped):");
for (const chunk of chunks.slice(0, 8)) {
    console.log(`  ${kb(chunk.gz).padStart(7)} KB  ${chunk.name}`);
}
console.log(
    `Total ${kb(total)} KB · vendor/OSMD ${kb(vendor)} KB · app ${kb(app)} KB ` +
        `(budgets: total ${BUDGET_TOTAL_KB}, app ${BUDGET_APP_KB})`,
);

const problems = [];
if (total / 1024 > BUDGET_TOTAL_KB) {
    problems.push(`total ${kb(total)} KB exceeds the ${BUDGET_TOTAL_KB} KB budget`);
}
if (app / 1024 > BUDGET_APP_KB) {
    problems.push(`app ${kb(app)} KB exceeds the ${BUDGET_APP_KB} KB budget`);
}
if (problems.length > 0) {
    console.error(
        `\nBundle over budget:\n- ${problems.join("\n- ")}\n` +
            "Trim the bundle, or raise the budget in dev/check-bundle-size.mjs deliberately.",
    );
    process.exit(1);
}
console.log("Bundle within budget.");

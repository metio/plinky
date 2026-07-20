// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Verifies the built client JavaScript stays within budget, so the bundle can't
// grow unnoticed — and that no dev-only surface leaks into what visitors run.
// Run after a SINGLE-locale build (`nix develop --command ci-build`, i.e.
// `PLINKY_LOCALE=en npm run build`) — the same build CI and the deploy measure. A
// plain all-locales `npm run build` is caught below and rejected, because its
// summed multi-language bundle is ~3× the per-visitor weight the budget tracks.
//
// Budgets are gzipped sizes and a ratchet: lower them as you trim; raise them
// deliberately when a feature genuinely needs the bytes. OpenSheetMusicDisplay is
// a large, pinned vendor dependency that is lazy-loaded only on score pages, so it
// is budgeted apart from our own code — that keeps an app-code regression visible
// instead of lost behind OSMD's bulk.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";

const CLIENT = "build/client";
const DIR = `${CLIENT}/assets`;

// The budget tracks what ONE visitor downloads — a single tree-shaken locale, the
// way the deploy ships it (dev/build-locales.mjs). A plain `npm run build`
// prerenders every language into build/client/<locale>/ and bundles all 26 copies
// of the UI copy; measuring that reports ~3× the real weight and trips the budget
// for the wrong reason. Detect it from the prerendered locale directories and say
// exactly what to build instead, so the failure explains itself.
const knownLocales = new Set(
    JSON.parse(readFileSync("./project.inlang/settings.json", "utf8")).locales,
);
const builtLocales = existsSync(CLIENT)
    ? readdirSync(CLIENT).filter(
          (name) => knownLocales.has(name) && statSync(`${CLIENT}/${name}`).isDirectory(),
      )
    : [];
if (builtLocales.length > 1) {
    console.error(
        `build/client holds ${builtLocales.length} prerendered locales — this is an ` +
            "all-locales `npm run build`, which the size gate can't measure (a visitor downloads " +
            "one language, not all of them).\n" +
            "Build a single locale the way CI and the deploy do:\n" +
            "  nix develop --command ci-build   # bakes in PLINKY_LOCALE=en npm run build\n" +
            "then re-run `npm run size`.",
    );
    process.exit(1);
}
const VENDOR = /opensheetmusicdisplay/;
// Chunks fetched only by a rare, deliberate act — the video export's encoder
// (WebCodecs adapter + mp4-muxer) loads on first use, never on a page visit —
// so like OSMD they are budgeted apart from the per-visitor app weight.
const ON_DEMAND = /webCodecsVideo/;

// The client bundle a SINGLE visitor downloads: the fixed OSMD vendor chunk
// (~310 KB, pinned) plus our own code. CI measures a per-locale build
// (`PLINKY_LOCALE=en npm run build`), because the deploy ships one tree-shaken
// bundle per language (dev/build-locales.mjs) — a German visitor never downloads
// Korean. So this tracks real per-visitor weight, not the summed all-locales output.
// The UI copy is inlined per locale, so the warmth of the writing has a byte cost:
// an invitation ("Give it a go, see how it lands") runs longer than the instruction
// it replaces. 565 bought that voice roughly 1 KB of room over the measured 564.1.
//
// The /ear page — the pure theory vocabulary and question generators, the interval
// ladder and answer keyboard, the listening stage, and 39 strings inlined per locale
// — adds ~4.5 KB, measured at 569.5. 570 keeps the same roughly-1-KB margin.
//
// Wiring ear rounds into the grades — the ear catalogue that places each exercise on the
// ladder, the bounded session that records mastery, three ear achievements, and 5 more
// strings per locale — adds ~1.6 KB, measured at 571.1. 572 keeps the margin.
//
// The first-class item kind (a piece opens a score, an ear item runs a drill) that
// retired the id-prefix sniffing — the shared practiceHref, the ear-review drill in the
// review session, and the /ear deep-link — adds ~0.9 KB, measured at 572.0. 573 restores
// the margin.
//
// The chords and scales ear exercises — the chord/scale theory tables and their two
// generators, the naming choice grid, and 33 more strings (the two exercises, their
// levels, and the chord/scale/mode names) inlined per locale — add ~1.5 KB, measured at
// 573.6. 575 restores the margin.
//
// The three functional exercises — the key-setting cadence, the scale-degree/interval-in-
// context/melodic-dictation generators, and 14 more strings per locale — add ~2 KB,
// measured at 575.5. 577 restores the margin.
//
// The About page — the two founder cards and the "why we made it" note, plus its nine
// strings inlined per locale — adds ~0.8 KB, measured at 577.8. 579 restores the margin.
//
// The notes-highway (on-screen reading mode + highway video-export format, with its five
// new strings inlined per locale) — adds ~0.5 KB, measured at 579.5. 580 restores the margin.
//
// The About page's contact section (five new strings inlined per locale) plus its
// accessibility note and the peck Easter egg — add ~0.2 KB, measured at 580.2. 581.
//
// The Impressum and Datenschutzerklärung — two prerendered legal routes whose German
// legal prose is inlined in the components — add ~1.8 KB, measured at 582.8. 583.
//
// The composer-page structured data (Person / ItemList / BreadcrumbList helpers in
// core/site, wired into the person route) — adds ~0.2 KB, measured at 583.2. 584.
//
// The skill-level preset + the Reading section of Settings (the ReadingLevel control,
// core/readingLevel, and the run-panel reading prefs mirrored onto the Settings page)
// — add ~1.8 KB, measured at 585.0. 586.
//
// The consent-gated analytics setting (analytics port + gtag adapter + the reactor +
// the Privacy Settings section; gtag.js itself loads externally, not bundled) — adds
// ~1.1 KB, measured at 586.1. 587.
const BUDGET_TOTAL_KB = 587;
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
// + a transpose context); and the absolute-beginner onboarding — the home
// Getting-started checklist, the note-name key labels with their Settings control and
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
//
// The microphone calibration wizard — the pure step machine, the raw-sample seam
// through the pitch port, and the guided setup panel that tunes the detector's
// noise floor, octave and velocity band to the player's own room — adds ~2 KB.
//
// The three-pedal support and its robustness pass — the live pedal-down tracking that
// seeds a mid-hold run's recording and lifts a pedal on device disconnect, the
// hold-flush that records a note still held at the finish, and the pedal-key editor that
// rejects a key already playing a note — adds ~1 KB.
//
// Making the review session reachable with nothing due — the always-on explanation of
// why pieces resurface, the link into the session, and the explainer the session shows
// in place of a dead end — adds ~0.5 KB. A feature nobody can find is cheaper still,
// which is not an argument for keeping it that way.
//
// Ear training as a page of its own — a second way to practise that needs no piano,
// so it carries its own route, two answer surfaces and its share of the copy — adds
// ~4.4 KB of app code, measured at 259.4.
//
// Ear rounds joining the grades — the session-recording and the ear catalogue on the
// You-page read path, plus the ear achievements — adds ~1 KB of app code, at 261.0.
//
// The chords and scales exercises — the naming choice grid and the two generators on the
// session's path — add ~1.5 KB of app code, measured at 263.5.
//
// The chord-progressions exercise — the sequence-entry surface (slots + keypad + undo)
// and the progression generator — adds ~1 KB of app code, measured at 264.5.
//
// The three functional exercises — dispatching a degree grid, the interval ladder and the
// generalized sequence entry, plus the shared exercise/level label maps — add ~1 KB of app
// code, measured at 265.4.
//
// The About page — a prerendered route with the two founder cards, the heart-shaped footer
// link into it, and the duet mark — adds ~1.6 KB of app code, measured at 267.6. 269 keeps
// the margin.
//
// The notes-highway — the on-screen falling-blocks reading mode (shared key-lane geometry,
// the matcher look-ahead, the NotesHighway panel) and the highway video-export format (the
// pure highwayBlocks layout and the takeHighwayPainter, offset by extracting the video
// painter's shared chrome/key helpers) plus its Style toggle and strings — adds ~1.5 KB of
// app code, measured at 269.4. 270 keeps the margin.
//
// The About page's contact section, the "everyone can play" accessibility note, and
// the tap-Sol's-portrait peck Easter egg (a little state + animated overlay) — add
// ~0.7 KB of app code, measured at 270.1. 271 keeps the margin.
//
// The Impressum + Datenschutzerklärung legal routes — their German legal text inlined in
// the two prerendered components + the footer links — add ~1.7 KB, measured at 272.7. 273.
//
// The composer-page structured data (Person / ItemList / BreadcrumbList helpers, wired
// into the person route) — adds ~0.1 KB of app code, measured at 273.1. 274.
//
// The skill-level preset + Settings Reading section (ReadingLevel control, core/
// readingLevel, the mirrored reading prefs) — add ~1.8 KB of app code, measured at
// 274.9. 276.
const BUDGET_APP_KB = 276;

// Dev-only surfaces that must never ship: the window.__plinky test bridge (it can
// inject MIDI, dump state, and wipe the device). Its source sits behind an
// `import.meta.env.PROD` early-return that the production build strips as dead
// code; this asserts the stripping actually happened, on the artifact itself.
const FORBIDDEN = ["__plinky", "Test bridge", "plinky-preview-mocks"];

const chunks = readdirSync(DIR)
    .filter((name) => name.endsWith(".js"))
    .map((name) => ({ name, gz: gzipSync(readFileSync(`${DIR}/${name}`)).length }))
    .sort((a, b) => b.gz - a.gz);

const leaks = readdirSync(DIR)
    .filter((name) => name.endsWith(".js"))
    .flatMap((name) => {
        const source = readFileSync(`${DIR}/${name}`, "utf8");
        return FORBIDDEN.filter((token) => source.includes(token)).map(
            (token) => `"${token}" found in ${name}`,
        );
    });
if (leaks.length > 0) {
    console.error(
        `Dev-only code leaked into the production bundle:\n- ${leaks.join("\n- ")}\n` +
            "The test bridge must stay behind its import.meta.env.PROD guard.",
    );
    process.exit(1);
}

const total = chunks.reduce((sum, chunk) => sum + chunk.gz, 0);
const vendor = chunks
    .filter((chunk) => VENDOR.test(chunk.name))
    .reduce((sum, chunk) => sum + chunk.gz, 0);
const onDemand = chunks
    .filter((chunk) => ON_DEMAND.test(chunk.name))
    .reduce((sum, chunk) => sum + chunk.gz, 0);
const app = total - vendor - onDemand;
const kb = (bytes) => (bytes / 1024).toFixed(1);

console.log("Largest client chunks (gzipped):");
for (const chunk of chunks.slice(0, 8)) {
    console.log(`  ${kb(chunk.gz).padStart(7)} KB  ${chunk.name}`);
}
console.log(
    `Total ${kb(total)} KB · vendor/OSMD ${kb(vendor)} KB · on-demand ${kb(onDemand)} KB · ` +
        `app ${kb(app)} KB (budgets: total ${BUDGET_TOTAL_KB}, app ${BUDGET_APP_KB})`,
);

const problems = [];
if ((total - onDemand) / 1024 > BUDGET_TOTAL_KB) {
    problems.push(`total ${kb(total - onDemand)} KB exceeds the ${BUDGET_TOTAL_KB} KB budget`);
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

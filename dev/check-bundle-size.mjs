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

import { readdirSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { requireSingleLocaleBuild } from "./single-locale-build.mjs";

const CLIENT = "build/client";
const DIR = `${CLIENT}/assets`;

// The budget measures what ONE visitor downloads: a single tree-shaken locale, the way
// the deploy ships it. The shared guard rejects an all-locales tree and names the
// command that produces the right one.
requireSingleLocaleBuild("the size gate");

const VENDOR = /opensheetmusicdisplay/;
// Chunks fetched only by a rare, deliberate act — the video export's encoder
// (WebCodecs adapter + mp4-muxer) loads on first use, never on a page visit —
// so like OSMD they are budgeted apart from the per-visitor app weight.
const ON_DEMAND = /webCodecsVideo/;

// What a single visitor downloads, in two independent measurements. CI builds one
// locale (`PLINKY_LOCALE=en npm run build`), because the deploy ships a tree-shaken
// bundle per language (dev/build-locales.mjs) — a German visitor never downloads
// Korean. So these track real per-visitor weight, not the summed all-locales output.
//
// There used to be a third budget over the total. It carried no signal of its own:
// total is app + vendor + on-demand, and the other two only move when a dependency
// is upgraded, so every ordinary feature moved the total and the app figure by the
// same amount and the two had to be raised together, in lockstep, forever. A gate
// that always fires alongside another gate is ceremony, not an alarm. The vendor
// budget below replaces it and watches the thing the total was accidentally
// hiding — a dependency growing — which the app budget genuinely cannot see.
// (Per-release totals from before the change are in git, not here.)
//
// OSMD is pinned and lazy-loaded on score pages; a jump here means a dependency
// grew, which is a different conversation from our own code growing.
//
// The line sits just above what opensheetmusicdisplay 2.1.1 actually measures,
// 323.5 KB gzipped — 13.4 KB more than 2.0.0 asked for. Nothing here is ours to
// trim: it is one vendor chunk, taken or not taken whole. The bytes buy the
// engine's own minor release, and the budget is set tight against them so the
// next dependency growth still has to be argued for rather than absorbed.
const BUDGET_VENDOR_KB = 324;
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
//
// The legal-page translations — the Impressum + Datenschutz prose moved into paraglide
// message keys (only the one built locale's strings ship) plus the LegalTranslationNotice
// banner — add ~0.6 KB of app code, measured at 276.6. 277.
//
// The analytics consent banner (ConsentBanner + its strings, the analyticsAsked pref)
// adds ~0.4 KB of app code, measured at 277.0. 278.
//
// The head-to-head duel verdict (raceVerdict/formatRaceMargin in core/ghost, the
// RaceVerdict card wired into the play surface, and its three won/lost/tie strings
// inlined per locale) — adds ~0.4 KB of app code, measured at 278.4. 279.
//
// The "Surprise me" flow pick (surprisePick + the Today-panel button) and the monthly
// recap card (monthlyRecap in core/history, RecapCard on the You page, and the surprise
// + recap strings per locale) — add ~0.8 KB of app code together, measured at 279.4. 280.
//
// The groove metronome control and the unlockable keyboard skins (useKeyboardTheme, the
// KeyboardThemePicker with its swatches and grade gating, the theme prop threaded through
// the shared Keyboard, and the groove + theme strings per locale) — measured at 280.1. 281.
//
// The play/listen bug-fix pass — the audio engine's scheduled-strike tracking so a panic
// silences notes queued ahead, the mic-pitch start generation guard with its resume and
// webkit fallback, the ear-level clamp, and the keyboard's navigation stopPropagation and
// seq-keyed miss flash — measured at 281.1. 282.
//
// The self-paced duet (core/duet's gap scheduler and the useDuet hook that plays the
// sitting-out hand at your live tempo, wired into playSession) — measured at 282.1. 283.
//
// The play run-setup regroup and the analytics event layer (track() through the gtag
// adapter, core/analyticsPrefs, the AnalyticsTracking watcher, and the run / video-export
// events) — net of dropping the full-screen setup sheet — measured at 283.2. 284.
//
// The analytics funnel events (the delegated click tracker, and the song/import/share/
// daily/review/compose/MIDI/milestone/keep-up events) — measured at 284.4. 285.
//
// Whole-device progress backup and restore (core/progressPack, the storage-seam
// export/import, and the Settings section) — measured at 285.6. 286.
//
// Sight-read mode (core/sightRead, useSightRead + useVanishingBars, and the
// run-setup block) — measured at 287.0. 288.
//
// The drill generator and its setup panel, net of the generator it replaces —
// measured at 289.1. 290.
//
// The placement test — measured at 291.4. 292. Its route is its own chunk; the
// app figure moves because the ladder and store are shared code.
//
// Handing an assignment back — measured at 294.9. 295.
//
// Solfège key labels (core/notes' degree map, the keyboard's syllable lookup, and
// seven translated syllables per locale) — measured at 295.0. 296.
//
// MIDI output echo (the output side of the port and adapter, core/midiMessage, the
// context's echo and its Settings switch) — measured at 296.2. 297.
//
// Echo release tracking (one pending release per note, plus the flush that runs
// when playback stops or the page goes away) — measured at 297.1. 298.
//
// The notation glossary — measured at 302.4. 303. All of it is the /glossary route's
// own 4.8 KB chunk (twelve examples, the snippet builder, the labels and the page), so
// a visitor who never opens the page downloads none of it. The app figure counts every
// chunk we ship on purpose: a whole new page is meant to show up here as a decision.
//
// Per-panel error boundaries — the boundary itself, its panel-sized fallback with the
// report link, and the three strings they need — measured at 303.8. 304. Unlike the
// glossary above, this is shared code on the entry page's path rather than a route
// chunk: the front page and the You page each wrap their panels in it.
//
// "In this piece" — the per-piece notation scan and the list it renders in the run-setup
// panel, plus its two strings — measured at 304.6. 305. It rides on the glossary's own
// labels rather than carrying copy of its own, which is most of why it is this small.
//
// The keyboard tour — the pure six-step machine, the guided surface it drives, and the
// two dozen strings it says — measured at 308.3. 309. It is a route chunk, so only a
// reader who opens it downloads it, and it brings no notation engine on arrival: the
// first four steps are the keyboard alone, and the staff loads when step five needs it.
//
// Bounds on what a malformed file or link may ask of the app — a four-byte cap on the
// MIDI variable-length reader, a meter the notation can actually spell, and a folded
// min/max a six-figure note list cannot overflow — measured at 309.2. 310. The smallest
// raise on this list and the one that carries no feature at all: it is what stops a
// corrupt .mid from locking the tab in a loop that no timeout can interrupt. Most of its
// weight was avoided rather than spent — core/meter.ts exists so the two file parsers
// keep type-only imports of the engraver instead of pulling it into their chunk.
//
// Six seams lifted out of the play surface — the run's grading, its recording, the take
// it saves without being asked, the claim that only the newest press may start a run,
// the order a run ends in, and the one door every note arrives at — measured at 310.0.
// 311. The first raise here that buys no capability at all: the app does exactly what it
// did, in 227 fewer lines of the file that had none of its logic under test and now has
// sixty-two tests over it. What the bytes actually pay for is the option objects and
// module boundaries an extraction needs. Two bugs came out of the work — a run that
// could start after the player had stopped, and a setter that ran its own argument
// twice — so some of it is paid back already. Trimmed first by deleting five session
// keys no consumer read.
const BUDGET_APP_KB = 311;

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
        `app ${kb(app)} KB (budgets: app ${BUDGET_APP_KB}, vendor ${BUDGET_VENDOR_KB})`,
);

const problems = [];
if (vendor / 1024 > BUDGET_VENDOR_KB) {
    problems.push(`vendor ${kb(vendor)} KB exceeds the ${BUDGET_VENDOR_KB} KB budget`);
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

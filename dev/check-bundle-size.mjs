// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

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

import { readdirSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { builtLocales, requireSingleLocaleBuild } from "./single-locale-build.mjs";

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
//
// 315. The practice diary: sessions folded from finished runs, a report over four
// windows with a consistency grid, target dates and derived practice stages on the
// pieces in progress, and a page naming six ways to practise. Roughly a third of the
// raise is the seventy-one new strings, which are inlined per locale, and the rest is
// three pure core modules plus their panels. The stage a piece has reached is derived
// from the review interval rather than stored, which is why the feature costs no
// storage format and no migration.
//
// 317. The expressive reading: how closely a run followed the written dynamics and
// articulation. Most of the cost is carrying what the score asks for through the step
// model and the capture; the scorer itself is one small pure module. Assignments
// gaining a target date rides along in the same raise.
//
// 319. The look-it-up page: a circle of fifths that names each key's signature and
// relative minor, scale and chord explorers over the existing keyboard and synth, and
// a tap-tempo reader. Two small pure modules plus twenty-three strings; the engines it
// draws on were already in the bundle, which is the whole reason the page is cheap.
//
// 326. Two pages that exist to be found: an eight-lesson theory course, and a person
// page for every composer the catalogue credits with three pieces or more. About half
// the raise is the baked composer index — 154 names and counts, in the person route's
// own chunk — which is what lets a prerendered composer page carry a real name and
// real structured data instead of a name guessed back from its URL. Trimmed first by
// baking only the composers actually prerendered: listing all 542 cost 6 KB more and
// bought nothing, since below that floor the manifest names them anyway.
//
// 328. Lighting the keys you are about to play, on a keyboard that illuminates them.
// Nearly all of it is the Settings panel and its fourteen strings; the parts that do
// the work — the picture, the diff, the MIDI adapter — are small, because the feature
// is plain note-on/note-off over the MIDI output that already existed.
//
// 329. Opening a song as piano music: the parts written for a singer or a second
// instrument are removed from the sheet before it loads, so the cursor and the matcher
// see the grand staff a piano learner came for. The cost is one MusicXML rewrite and
// the Settings switch that brings the rest back.
//
// 330. Reading a position as the several instructions it is: what the score asks of each
// key of a chord, what each was struck at, and how long each was held — carried per pitch
// through the matcher, the capture and the expressive reading rather than collapsed onto
// the position's longest note.
//
// 331. Following the sustain pedal the score marks, and the notation reading around it —
// the pedal spans, the ornament split, and the per-position timing the graded run and
// Listen now share. The line moved by one because the previous one measured 329.95 here
// and 330.04 on CI: both print as 330.0, so the gate passed locally and failed there.
// Displayed KB is rounded; the comparison is not.
//
// 333. The help page's own words. The text moved out of Sanity and into the message
// catalogue, so it is bundled per locale like every other string and a reader gets the
// help that belongs to their build, offline included. Most of its weight was paid for by
// deleting what it replaced — the three content adapters, the board page and the news
// banner — leaving barely a kilobyte net.
//
// 334. The export panel's look options: a note colour and a keyboard depth for the
// notes-highway video, each a segmented control with its own labels in every locale. The
// measured cost is a tenth of a kilobyte over the previous line — the controls and the
// look table were already there, and only the labels are new — but the comparison is
// against the unrounded figure, so the line has to move for it to pass.
//
// 331. Google Analytics is gone, and with it the gtag adapter, the analytics port, the
// consent banner, the Settings toggle and the click tracker. Cloudflare's beacon is a
// script tag in the document rather than anything bundled, so what replaced roughly
// three kilobytes of app code weighs nothing here.
//
// 333. Four places instead of five: a Learn hub gathering the pages that used to hang
// off the help page, the day's practice as three moments, and the help text rewritten
// to describe them. Copy is inlined per locale, so a paragraph costs more than the
// component that renders it — most of the kilobyte and a half is the new help sections
// and the Learn page's own prose, not the route.
//
// 336. Incipits: the reader that lifts a piece's opening bars, the drawing that puts
// them on a staff, and the encoding that carries one per piece in the catalogue
// manifest. Two kilobytes of app code; the marks themselves are manifest bytes, not
// bundle bytes, and cost about 39 KB gzipped on a file the browsing visitor already
// fetches.
//
// 337. The front page greets the moment you arrived — the weekday from the reader's own
// clock, the part of day from a pure hour test — over a line saying where you stand.
//
// 338. The theory course remembers which lessons have been met, so the day's practice
// offers the next one and stops offering a course there is nothing left of.
// 339. Scales and arpeggios are named in the reader's language: seventeen title and form
// strings per locale, plus the table that picks one. The manifest's English titles are
// still there — they name the score's own <work-title> — so this pays for the language
// the reader actually gets, in a build carrying one locale.
// 340. A piece's page names what can be done to it. The twelve ways to work a piece used
// to sit behind a fold — two for a beginner — so the page carried a summary and nothing
// else; now How you play and Extra challenge are on it, the eight-grade map says every
// piece is open and links to each grade's shelf, and every library row draws its opening
// bars. The marks themselves are manifest bytes, not bundle bytes.
// 342. Your own recordings are listed on the shelf — a piece was the only way to reach
// one, so a take whose title you had forgotten was unreachable — and Today's setup steps
// moved into the three moments, which cost a component and gave one back.
// 343. One Card and one PageHeader replaced eight hand-rolled panels and twenty-two
// title blocks. A shared component costs a little more than the markup it replaces, and
// buys a page that cannot drift again.
// 346. Six more theory lessons — length, silence, the left hand's clef, the relative
// minor and the two chord lessons — and two more little tools, an interval finder and the
// metronome the tap tool now hands its number to. The lessons are copy and a table; the
// tools are two panels over engines that were already running.
// 348. Six more marks in the glossary, and the rule that finds each of them in a piece —
// including ledger lines, which nothing in a file marks, so they are worked out from the
// pitch and the clef.
// 350. The recorded grand piano: the mapping from a key and a force to a recording, the
// cache that holds them, the sampled voice, and the switch that asks for it. The
// recordings themselves are not here and never will be — they are fetched from their own
// origin, a piece's worth at a time.
// 360. Fitting a piece to the keyboard actually plugged in: the range read off a score,
// the octave shift that brings it into reach, and the panel that remembers which
// instrument it is. Step entry, which writes a piece down a note at a time rather than
// playing it. The composer directory, which lists everybody the catalogue credits
// instead of the few with pages the prerender holds. And the baked opening bars taking
// a colour, so the shelf and the piece it opens agree about what a note is called.
// 365. The rhythm trainer: the graded ladder of figures and the generator that fills a
// bar from them, the nearest-first matching that decides which written note a tap was
// aimed at, and the notation. That last one is drawn here rather than engraved — a
// rhythm has no pitch, so it needs no clef, no key and no staff to place anything on,
// and routing it through the score engine would pull the whole notation machinery onto
// a page that needs none of it. Drawing it costs about a kilobyte; the engine would
// have cost the page its whole budget. Also: the diatonic chord worksheet and the
// second export format on the tools page, and the practice-time-per-piece panel.
// 367. Reading the music out of the file instead of out of the engraver: the timeline
// (onsets, lengths, chords, backups, ties, divisions), the marks written over it
// (dynamics and hairpins, pedal, octave lines, arches, the key), and the repeat structure.
// About a kilobyte, and it buys the retirement of the readers that caused the two worst
// silent bugs this app has had — dynamics that returned null for every real score for
// years, and slurs that joined only the first note of every phrase — plus correct timing
// on the thirteen per cent of the catalogue that overruns its own barlines.
// 368. Telling the player what is happening while they wait, and while the numbers at the
// end of a run are read: the staff that stands in for a piece that is still arriving (with
// a word for which half of the wait it is), the spinner beside the finger-numbers switch,
// the key for the coloured dots, and the fold-away explanation of what each score measures.
// Almost all of it is the strings; the drawing is a handful of lines. Measured first — a
// throttled-CPU, throttled-network benchmark (dev/bench-score.mjs) put a piece at three to
// five seconds before a single mark appeared, of which about half is the engraver's own
// work and cannot be given back. So it is spent on making the wait legible rather than on
// pretending it is shorter.
// 369. Reading one piece's row out of a slice of the catalogue rather than the whole
// manifest, and asking for the engraver from the route module instead of waiting for the
// score component to mount. A third of a kilobyte of shard arithmetic and a one-line warm-up,
// against 1.45 s off the time a piece takes to appear on a throttled phone — 7.75 s to
// 6.30 s at four-times CPU over Fast 4G, measured cold with dev/bench-score.mjs, ranges not
// overlapping. It also takes 600 KB off what opening a piece downloads at all, which is the
// part that matters on a metered connection.
// 370. What the page says, reaching the sound at last. A rit. or an accel. now gives in the
// pulse instead of doing nothing — 660 pieces in the catalogue print one — and a piece that
// changes key part way through spells its ornaments from the key it is actually in, which
// 383 of them need. Both are timelines the file reader already had the walk for, so the cost
// is the interpolation and the vocabulary of words engravings use for "slower".
// 371. The last of the shorthand the page uses and the sound ignored: the tremolo (135
// pieces, and the alternating form is two thirds of them), the glissando (12), the middle
// pedal, and the soft pedal (59). Each is a figure or a foot that has to be spelled out to
// be heard, and each was printed and silent.
// 372. Menus that close the way every other menu closes — a press elsewhere, or Escape.
// A fifth of a kilobyte for a hook two of them share, against a reported bug where the only
// way out of the Export menu was the button that opened it.
// 382. Every composer gets a prerendered page, not only the ones with three pieces or more.
// The floor bought a page whose behaviour depended on how many pieces its composer happened
// to have — prerendered above the line, client-rendered below it — and merging the duplicate
// spellings moved composers across that line in both directions. The index it is built from
// ships in the app bundle as the name a person page shows before the catalogue arrives, so
// it went from 157 entries to 403: 3.0 KB gzipped to 7.7. The prerendered set went from
// 4,082 pages to 10,634.
// 383. A credit naming two composers gives each of them a page. personSlugs answers every
// person in a credit where personSlug answered one, and the split runs on the cleaned name
// so the credits that only look like two people stay whole. The weight is the four
// composites leaving the index and the eight real people arriving in their place, plus the
// splitting itself — a tenth of a kilobyte over the line, for pages that had been credited
// to a composer who never existed while neither real one was credited at all.
// 384. A theory lesson became one timeline that the page, the speakers and the keyboard
// all read. They read three before — an engraver deriving half notes from a pitch set, a
// player striking every pitch of a phrase at once, a keyboard lighting the lot statically
// — and three derivations of one idea disagree: the lesson about note length struck seven
// identical notes together, which is one note, and the lesson about rests played both
// notes at once, so the silence it teaches could not happen. Seven demo kinds collapse
// into one shape, and what that deletes very nearly pays for what it adds. The seven
// tenths of a kilobyte over the line are the timeline module — its engraving, its clock,
// and the spelling that finally lets a black key be drawn — plus the helper that puts a
// link inside a translated sentence without cutting the sentence into fragments. The
// eight lessons that gained a written example cost nothing here: the engraver was already
// on the page for the other six.
// 386. Faults that never reach a React boundary are written down and shown in Settings,
// with the same one-press report the crash page offers. A rejected promise or a throw
// from a timer used to leave nothing at all — no fallback, no link, a feature that simply
// stopped working — and with every push deploying, the only signal was somebody thinking
// to say so. The weight is the bounded log in core, its store, the window adapter and the
// panel: 1.1 KB, measured at 385.1.
//
// Worth recording about the measurement rather than the feature: this figure sums every
// chunk across all 25 routes, so it is not what any one visitor downloads (the play page
// is ~262 KB eager, home ~205 KB) and it can only ever rise — a new page raises it even
// when nobody's download grew. That is why this ledger holds some fifty raises and two
// falls. A per-document budget computed from the built HTML would be the honest gate and
// could fall; until then this one keeps its one real virtue, which is making a human
// decide.
// 387. Values on a device now carry the shape they were written in, and a build that
// does not know that shape stops writing rather than flattening it. Every push deploys
// and a tab applies the new build only at its next route change, so two builds run at
// once routinely — and an older one reads a field it does not know as a default, then
// writes that default back. The weight is the version check, the store that enforces it
// and a second banner message, since telling somebody on a stale tab that their storage
// is full sends them off deleting files that were never the trouble. 0.3 KB, measured at
// 386.2.
// 411. Not a regression: the same code, weighed honestly for the first time. Every
// per-visitor gate built English, which is the one language none of them needed to
// check — it is the shortest, and every string in the app was written to fit in it. A
// budget is a claim about what a visitor downloads, and a Greek visitor downloads 2.07
// times the message bytes an English one does. Measured, that is 21.8 KB nobody had ever
// weighed: 410.0 against the 388.2 this line was set to. The build now picks the heaviest
// language (dev/locale-stress.mjs --heaviest), so the claim is that the worst case fits
// and therefore all twenty-six do. Expect this figure to move when the translations do;
// the gate prints the locale it weighed so a jump can be read.
// 389. Two things, both of which the app has to be able to do rather than only the build.
// The difficulty model learned how much time a player has: movement between positions is
// discounted by the gap before it, which is what stops a slow wide left hand reading as
// harder than a fast one, and it also reads the key signature, how far each hand travels
// and — weakly, capped — how much of the piece there is. That model runs in the browser
// too, on an imported score and behind every grade chip, so its terms and the shared clock
// that times a score (core/scoreTiming) are per-visitor weight. The fingering trainer reads
// the same clock, so its advice and the marks judging that advice are priced alike. The
// rest is the named works: a set resolved by the bake becomes a built-in assignment, which
// costs a source method, a card that folds its steps away and mounts them on opening, and
// one message. Two hundred and sixty piece ids are a fetched file, not bundle. 2.0 KB,
// measured at 388.2.
// 412. The keyboard is one component now. It was four — the front page had a flat bright
// one, the play surface, Compose and the lessons each had their own, and the canvas painter
// behind an exported video had its shading baked into three constants, in colours that
// existed nowhere else. Sharing them costs less than the four did, but the choice they now
// carry is new weight a visitor downloads: a finish describes itself twice over, as numbers
// for the canvas and as literal class names for the page, because Tailwind cannot read a
// gradient and a canvas cannot read a class, and neither face can be generated at runtime.
// On top of that sit the picker, the hook that subscribes to the stored answer, and the
// pref itself. 0.4 KB, measured at 411.4.
const BUDGET_APP_KB = 412;

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

// Which language was weighed, because the answer moves with the translations and a jump
// in the figure is otherwise unreadable. The build picks the heaviest, so this is the most
// any visitor downloads rather than the least.
console.log(`Measuring the ${builtLocales()[0] ?? "?"} build — the heaviest of the 26.`);
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

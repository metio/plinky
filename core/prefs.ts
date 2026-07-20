// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { type Beams, BEAMS } from "./beams";
import type { Letter } from "./grade";
import { cleanKeyMap, DEFAULT_KEY_MAP, type KeyMap } from "./keyMap";
import type { MicCalibration } from "./pitch";
import { type DecayMode, REVIEW_CAP } from "./review";

// A hand's comfortable thumb-to-pinky reach in semitones, or null when unmeasured
// — people with one hand set only the hand they have. Personalizes the suggested
// fingering to the player's reach.
export type HandSpan = { left: number | null; right: number | null };

// When the practice keyboard reveals the next note to play: always (a guided
// crutch), only once you've played a wrong note (read first, helped when stuck),
// or never (pure sight-reading). A wrong key still flashes red regardless.
export type NoteHints = "always" | "miss" | "never";

// Whether the keys carry their note name, for a player still learning where the notes
// are: every key labelled (all), only the C keys as orientation landmarks (c — the
// white key left of each two-black-key group), or bare (off) once the map is second
// nature.
export type NoteLabels = "all" | "c" | "off";

export type Prefs = {
    sound: boolean;
    volume: number; // 0..100
    masteryThreshold: Letter; // grade a score must reach to count as learned
    handSpan: HandSpan;
    // Print the suggested fingering numbers on the staff. Off by default for a cleaner
    // score — a player turns them on (in Settings, or with the in-play toggle) when they
    // want the hint, the way they'd read fingering off printed sheet music only when
    // stuck.
    showFingerings: boolean;
    // Whether the score joins fast notes into beam groups. "auto" (the default) follows
    // the piece's difficulty — flags on the easy grades a beginner reads note-by-note,
    // beat-grouping beams once they help — and "on"/"off" force it either way.
    beams: Beams;
    // Colour the noteheads by note name (a Boomwhacker reading aid), so a beginner reads
    // pitch by hue. Off by default — standard black notation. The played/heard feedback
    // rides behind the notes as a halo, so the colours stay readable as you play.
    colorNotes: boolean;
    noteHints: NoteHints;
    noteLabels: NoteLabels;
    // Keep going past a slip: when on, playing the next note advances the score even if a
    // note (often the wrong hand on a two-hand piece) was missed, so a mistake never
    // freezes you mid-piece. Off waits for every note, which builds accuracy.
    forgiving: boolean;
    // Live green/amber/red feedback as you finger a passage. On by default, but the
    // guidance-hypothesis warns constant feedback can stunt self-judgement, so a learner
    // can fade it off and rely on the post-phrase summary.
    fingerHints: boolean;
    // How a grade decays when its pieces go unreviewed: gentle keeps the grade and
    // only dulls its shine, competitive lets it actually slip — the opt-in challenge.
    decayMode: DecayMode;
    // Most pieces to surface for review at once, so a long-neglected library doesn't
    // present an overwhelming wall — a daily dose the player can actually finish.
    reviewCap: number;
    // How many bars to force onto each staff row, or 0 to let the width decide. Fewer
    // bars per row means bigger, more readable notation — the lever a phone needs so the
    // notes aren't crammed too small to play. Stored per device.
    barsPerRow: number;
    // A magnification applied to the whole rendered score (1 = normal). Unlike
    // bars-per-row it scales the glyphs themselves, so it enlarges the notation even in
    // treadmill mode and helps a learner (or anyone) who needs bigger notes. Per device.
    noteScale: number;
    // Show a bar number above the first bar of each staff row, so a passage is easy to
    // point to and matches the loop's from/to inputs. When shown they sit at each row's
    // start rather than at OSMD's default cadence, which drifts with the layout — the
    // fix for numbers appearing on different bars every time the score re-flows. Off
    // clears them for a cleaner staff.
    barNumbers: boolean;
    // Which computer-keyboard key plays each note, per hand. Defaults to the five-finger
    // home-row split; a player can remap it (see keyMap), and the keyboard input layer
    // reads this.
    keyMap: KeyMap;
    // The metronome's finer voice, set once in Settings: how many clicks divide
    // each beat, whether the downbeat is accented louder than the rest, and
    // whether the pulse adapts to the player's own pace.
    metronomeSubdivision: number;
    metronomeAccent: boolean;
    metronomeAdaptive: boolean;
    // Render the piece as one continuous horizontal line that scrolls under a fixed gaze
    // as you play (a notation "treadmill"), instead of wrapping into stacked rows. Off by
    // default — the wrapped score is the familiar reading layout.
    treadmill: boolean;
    // Show the upcoming notes as blocks falling onto the on-screen keys (a Synthesia-style
    // "notes highway"), above the staff, to train finding the keys. Off by default — the
    // staff is the reading surface; the highway is an opt-in aid.
    highway: boolean;
    // Race a translucent replay of your best run (or fastest saved take) on the piece
    // while you practise. On by default; turn it off to practise without the chase.
    raceGhost: boolean;
    // Practise by ear: the noteheads start hidden and each one is revealed as it is
    // resolved — green when you find it, red once the tries budget is spent. Listen
    // first, then play back what you heard.
    hiddenNotes: boolean;
    // How many wrong attempts a hidden note allows before it reveals itself red.
    revealTries: number;
    // The microphone tuned to this device's room, piano and mic by the calibration
    // wizard, or null when the player has never run it (the detector's own defaults
    // stand in). Stored per device — a different room needs a different tuning.
    micCalibration: MicCalibration | null;
    // Whether the player has consented to anonymous usage analytics (Google
    // Analytics). Off by default — nothing loads or is sent until it is true. Set by
    // the first-visit consent banner or the Settings toggle. A monetisation opt-in
    // sits beside it later.
    analyticsConsent: boolean;
    // Whether the consent choice has been made at all. False until the visitor
    // answers the banner (accept or decline) or uses the Settings toggle; the banner
    // shows only while this is false, so a decline is remembered and never nags.
    analyticsAsked: boolean;
};

// The review-cap choices, all bounded: there is deliberately no "unlimited", so the
// queue stays a finishable session rather than a guilt pile.
export const REVIEW_CAPS = [5, 8, 12, 20];

// Bars-per-row choices: 0 = fit to width (the default), or force 2–4 for bigger bars.
export const BARS_PER_ROW = [0, 2, 3, 4];

// Note-size choices: the score's magnification. 1 = normal, up to 1.5× for a learner
// who needs bigger glyphs (or a small screen held at arm's length).
export const NOTE_SCALES = [1, 1.25, 1.5];

// Metronome subdivision choices: clicks per beat (2 = eighths, 3 = triplets…).
export const METRONOME_SUBDIVISIONS = [1, 2, 3, 4];

// Tries a hidden note allows before revealing red. Bounded small: the reveal is
// the lesson, and endless guessing teaches nothing.
export const REVEAL_TRIES = [1, 2, 3];

const LETTERS: Letter[] = ["S", "A", "B", "C", "D"];
const NOTE_HINTS: NoteHints[] = ["always", "miss", "never"];
const NOTE_LABELS: NoteLabels[] = ["all", "c", "off"];
const DECAY_MODES: DecayMode[] = ["gentle", "competitive"];

export function clampVolume(value: number): number {
    return Math.max(0, Math.min(100, Math.round(value)));
}

// The three field coercions every stored preference is built from. Each one owns the
// single decision "is this stored value usable, or does the default stand?", so a new
// preference reuses a tested branch instead of adding its own.

// Reads a stored boolean; anything else (absent, wrong type, truthy string) defaults.
function bool(value: unknown, fallback: boolean): boolean {
    return typeof value === "boolean" ? value : fallback;
}

// Reads a stored value constrained to a closed set of choices. The set is the
// authority: a value outside it — a retired choice, a hand-edited store — defaults.
function oneOf<T>(value: unknown, allowed: readonly T[], fallback: T): T {
    return allowed.includes(value as T) ? (value as T) : fallback;
}

// Reads a stored number onto a continuous range, rounding and clamping into band.
// A non-finite value has no sensible place on the range, so it defaults rather than
// clamping to an edge.
function num(value: unknown, clamp: (value: number) => number, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? clamp(value) : fallback;
}

// A reach below a fifth or beyond two octaves is taken as bad data and dropped to
// null, so a corrupt store can't feed nonsense into the fingering model.
function cleanSpan(value: unknown): number | null {
    return typeof value === "number" && value >= 5 && value <= 24 ? Math.round(value) : null;
}

function cleanHandSpan(value: unknown): HandSpan {
    const span = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
    return { left: cleanSpan(span.left), right: cleanSpan(span.right) };
}

function defaults(): Prefs {
    return {
        sound: true,
        volume: 80,
        masteryThreshold: "A",
        handSpan: { left: null, right: null },
        showFingerings: false,
        beams: "auto",
        colorNotes: true,
        noteHints: "always",
        noteLabels: "all",
        forgiving: false,
        fingerHints: true,
        decayMode: "gentle",
        reviewCap: REVIEW_CAP,
        barsPerRow: 0,
        noteScale: 1,
        barNumbers: true,
        keyMap: cleanKeyMap(undefined),
        metronomeSubdivision: 1,
        metronomeAccent: true,
        metronomeAdaptive: false,
        treadmill: false,
        highway: false,
        raceGhost: true,
        hiddenNotes: false,
        revealTries: 1,
        micCalibration: null,
        analyticsConsent: false,
        analyticsAsked: false,
    };
}

// A stored calibration is trusted only when every field is a finite number in a
// sane band and the loud anchor clears the soft one — a corrupt or hand-edited
// store falls back to null (the detector's defaults) rather than feeding a
// nonsense floor or a collapsed velocity map into the live path.
function cleanCalibration(value: unknown): MicCalibration | null {
    if (!value || typeof value !== "object") {
        return null;
    }
    const cal = value as Record<string, unknown>;
    const finite = (x: unknown, low: number, high: number): x is number =>
        typeof x === "number" && Number.isFinite(x) && x >= low && x <= high;
    if (
        !finite(cal.noiseFloor, 0.001, 0.3) ||
        !finite(cal.softLevel, 0.001, 0.5) ||
        !finite(cal.loudLevel, 0.001, 0.5) ||
        !finite(cal.octaveShift, -2, 2) ||
        !Number.isInteger(cal.octaveShift) ||
        cal.loudLevel <= cal.softLevel
    ) {
        return null;
    }
    return {
        noiseFloor: cal.noiseFloor,
        softLevel: cal.softLevel,
        loudLevel: cal.loudLevel,
        octaveShift: cal.octaveShift,
    };
}

// A stable defaults object for render snapshots (server render, first hydration):
// the same reference every time, so a subscription snapshot never loops. Frozen —
// callers copy before changing, as they do with any loaded prefs.
export const DEFAULT_PREFS: Readonly<Prefs> = Object.freeze({
    ...defaults(),
    handSpan: Object.freeze({ left: null, right: null }),
    keyMap: Object.freeze(DEFAULT_KEY_MAP) as KeyMap,
});

// Parses a raw stored string (or null for nothing stored) into full, valid Prefs.
// Every field is coerced or dropped to its default, so a corrupt or stale store can
// never leak an out-of-range value into the app.
export function parsePrefs(raw: string | null): Prefs {
    const base = defaults();
    try {
        const parsed = JSON.parse(raw ?? "{}");
        return {
            sound: bool(parsed.sound, base.sound),
            volume: num(parsed.volume, clampVolume, base.volume),
            masteryThreshold: oneOf(parsed.masteryThreshold, LETTERS, base.masteryThreshold),
            handSpan: cleanHandSpan(parsed.handSpan),
            showFingerings: bool(parsed.showFingerings, base.showFingerings),
            beams: oneOf(parsed.beams, BEAMS, base.beams),
            colorNotes: bool(parsed.colorNotes, base.colorNotes),
            noteHints: oneOf(parsed.noteHints, NOTE_HINTS, base.noteHints),
            noteLabels: oneOf(parsed.noteLabels, NOTE_LABELS, base.noteLabels),
            forgiving: bool(parsed.forgiving, base.forgiving),
            fingerHints: bool(parsed.fingerHints, base.fingerHints),
            decayMode: oneOf(parsed.decayMode, DECAY_MODES, base.decayMode),
            reviewCap: oneOf(parsed.reviewCap, REVIEW_CAPS, base.reviewCap),
            barsPerRow: oneOf(parsed.barsPerRow, BARS_PER_ROW, base.barsPerRow),
            noteScale: oneOf(parsed.noteScale, NOTE_SCALES, base.noteScale),
            barNumbers: bool(parsed.barNumbers, base.barNumbers),
            keyMap: cleanKeyMap(parsed.keyMap),
            metronomeSubdivision: oneOf(
                parsed.metronomeSubdivision,
                METRONOME_SUBDIVISIONS,
                base.metronomeSubdivision,
            ),
            metronomeAccent: bool(parsed.metronomeAccent, base.metronomeAccent),
            metronomeAdaptive: bool(parsed.metronomeAdaptive, base.metronomeAdaptive),
            treadmill: bool(parsed.treadmill, base.treadmill),
            highway: bool(parsed.highway, base.highway),
            raceGhost: bool(parsed.raceGhost, base.raceGhost),
            hiddenNotes: bool(parsed.hiddenNotes, base.hiddenNotes),
            revealTries: oneOf(parsed.revealTries, REVEAL_TRIES, base.revealTries),
            micCalibration: cleanCalibration(parsed.micCalibration),
            analyticsConsent: bool(parsed.analyticsConsent, base.analyticsConsent),
            analyticsAsked: bool(parsed.analyticsAsked, base.analyticsAsked),
        };
    } catch {
        return base;
    }
}

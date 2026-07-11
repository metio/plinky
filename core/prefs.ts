// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Letter } from "./grade";
import { cleanKeyMap, DEFAULT_KEY_MAP, type KeyMap } from "./keyMap";
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
    // How many octaves of the on-screen keyboard to show while playing — a window that
    // follows the notes, so a wide piece's keys stay a playable size — or 0 to frame the
    // whole piece at once (fixed, never sliding, for players who prefer a stable map).
    keyboardOctaves: number;
    // Render the piece as one continuous horizontal line that scrolls under a fixed gaze
    // as you play (a notation "treadmill"), instead of wrapping into stacked rows. Off by
    // default — the wrapped score is the familiar reading layout.
    treadmill: boolean;
    // Race a translucent replay of your best run (or fastest saved take) on the piece
    // while you practise. On by default; turn it off to practise without the chase.
    raceGhost: boolean;
    // Practise by ear: the noteheads start hidden and each one is revealed as it is
    // resolved — green when you find it, red once the tries budget is spent. Listen
    // first, then play back what you heard.
    hiddenNotes: boolean;
    // How many wrong attempts a hidden note allows before it reveals itself red.
    revealTries: number;
};

// The review-cap choices, all bounded: there is deliberately no "unlimited", so the
// queue stays a finishable session rather than a guilt pile.
export const REVIEW_CAPS = [5, 8, 12, 20];

// Bars-per-row choices: 0 = fit to width (the default), or force 2–4 for bigger bars.
export const BARS_PER_ROW = [0, 2, 3, 4];

// On-screen-keyboard window choices, in octaves: a sliding 1–3-octave window that
// follows the notes, or 0 for the whole piece framed at once (fixed).
export const KEYBOARD_OCTAVES = [0, 1, 2, 3];

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
        noteHints: "miss",
        noteLabels: "c",
        forgiving: false,
        fingerHints: true,
        decayMode: "gentle",
        reviewCap: REVIEW_CAP,
        barsPerRow: 0,
        barNumbers: true,
        keyMap: cleanKeyMap(undefined),
        keyboardOctaves: 2,
        treadmill: false,
        raceGhost: true,
        hiddenNotes: false,
        revealTries: 1,
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
            sound: typeof parsed.sound === "boolean" ? parsed.sound : base.sound,
            volume: typeof parsed.volume === "number" ? clampVolume(parsed.volume) : base.volume,
            masteryThreshold: LETTERS.includes(parsed.masteryThreshold)
                ? parsed.masteryThreshold
                : base.masteryThreshold,
            handSpan: cleanHandSpan(parsed.handSpan),
            showFingerings:
                typeof parsed.showFingerings === "boolean"
                    ? parsed.showFingerings
                    : base.showFingerings,
            noteHints: NOTE_HINTS.includes(parsed.noteHints) ? parsed.noteHints : base.noteHints,
            noteLabels: NOTE_LABELS.includes(parsed.noteLabels)
                ? parsed.noteLabels
                : base.noteLabels,
            forgiving: typeof parsed.forgiving === "boolean" ? parsed.forgiving : base.forgiving,
            fingerHints:
                typeof parsed.fingerHints === "boolean" ? parsed.fingerHints : base.fingerHints,
            decayMode: DECAY_MODES.includes(parsed.decayMode) ? parsed.decayMode : base.decayMode,
            reviewCap: REVIEW_CAPS.includes(parsed.reviewCap) ? parsed.reviewCap : base.reviewCap,
            barsPerRow: BARS_PER_ROW.includes(parsed.barsPerRow)
                ? parsed.barsPerRow
                : base.barsPerRow,
            barNumbers:
                typeof parsed.barNumbers === "boolean" ? parsed.barNumbers : base.barNumbers,
            keyMap: cleanKeyMap(parsed.keyMap),
            keyboardOctaves: KEYBOARD_OCTAVES.includes(parsed.keyboardOctaves)
                ? parsed.keyboardOctaves
                : base.keyboardOctaves,
            treadmill: typeof parsed.treadmill === "boolean" ? parsed.treadmill : base.treadmill,
            raceGhost: typeof parsed.raceGhost === "boolean" ? parsed.raceGhost : base.raceGhost,
            hiddenNotes:
                typeof parsed.hiddenNotes === "boolean" ? parsed.hiddenNotes : base.hiddenNotes,
            revealTries: REVEAL_TRIES.includes(parsed.revealTries)
                ? parsed.revealTries
                : base.revealTries,
        };
    } catch {
        return base;
    }
}

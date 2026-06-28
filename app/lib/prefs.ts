// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Letter } from "./grade";
import { type DecayMode, REVIEW_CAP } from "./gradeProgress";

// A hand's comfortable thumb-to-pinky reach in semitones, or null when unmeasured
// — people with one hand set only the hand they have. Personalizes the suggested
// fingering to the player's reach.
export type HandSpan = { left: number | null; right: number | null };

// When the practice keyboard reveals the next note to play: always (a guided
// crutch), only once you've played a wrong note (read first, helped when stuck),
// or never (pure sight-reading). A wrong key still flashes red regardless.
export type NoteHints = "always" | "miss" | "never";

export type Prefs = {
    sound: boolean;
    volume: number; // 0..100
    masteryThreshold: Letter; // grade a score must reach to count as learned
    handSpan: HandSpan;
    // Show the suggested finger on the practice keyboard; off lets a learner work
    // fingerings out unaided, the way they must at a real piano.
    showFingerings: boolean;
    noteHints: NoteHints;
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
    // notes aren't crammed too small to play. Stored per device (localStorage).
    barsPerRow: number;
};

// The review-cap choices, all bounded: there is deliberately no "unlimited", so the
// queue stays a finishable session rather than a guilt pile.
export const REVIEW_CAPS = [5, 8, 12, 20];

// Bars-per-row choices: 0 = fit to width (the default), or force 2–4 for bigger bars.
export const BARS_PER_ROW = [0, 2, 3, 4];

const KEY = "plinky:prefs";
const DEFAULTS: Prefs = {
    sound: true,
    volume: 80,
    masteryThreshold: "A",
    handSpan: { left: null, right: null },
    showFingerings: true,
    noteHints: "miss",
    forgiving: false,
    fingerHints: true,
    decayMode: "gentle",
    reviewCap: REVIEW_CAP,
    barsPerRow: 0,
};
const LETTERS: Letter[] = ["S", "A", "B", "C", "D"];
const NOTE_HINTS: NoteHints[] = ["always", "miss", "never"];
const DECAY_MODES: DecayMode[] = ["gentle", "competitive"];

function clampVolume(value: number): number {
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

export function loadPrefs(): Prefs {
    try {
        const parsed = JSON.parse(localStorage.getItem(KEY) ?? "{}");
        return {
            sound: typeof parsed.sound === "boolean" ? parsed.sound : DEFAULTS.sound,
            volume:
                typeof parsed.volume === "number" ? clampVolume(parsed.volume) : DEFAULTS.volume,
            masteryThreshold: LETTERS.includes(parsed.masteryThreshold)
                ? parsed.masteryThreshold
                : DEFAULTS.masteryThreshold,
            handSpan: cleanHandSpan(parsed.handSpan),
            showFingerings:
                typeof parsed.showFingerings === "boolean"
                    ? parsed.showFingerings
                    : DEFAULTS.showFingerings,
            noteHints: NOTE_HINTS.includes(parsed.noteHints)
                ? parsed.noteHints
                : DEFAULTS.noteHints,
            forgiving:
                typeof parsed.forgiving === "boolean" ? parsed.forgiving : DEFAULTS.forgiving,
            fingerHints:
                typeof parsed.fingerHints === "boolean" ? parsed.fingerHints : DEFAULTS.fingerHints,
            decayMode: DECAY_MODES.includes(parsed.decayMode)
                ? parsed.decayMode
                : DEFAULTS.decayMode,
            reviewCap: REVIEW_CAPS.includes(parsed.reviewCap)
                ? parsed.reviewCap
                : DEFAULTS.reviewCap,
            barsPerRow: BARS_PER_ROW.includes(parsed.barsPerRow)
                ? parsed.barsPerRow
                : DEFAULTS.barsPerRow,
        };
    } catch {
        return { ...DEFAULTS, handSpan: { ...DEFAULTS.handSpan } };
    }
}

export function savePrefs(prefs: Prefs): void {
    try {
        localStorage.setItem(KEY, JSON.stringify({ ...prefs, volume: clampVolume(prefs.volume) }));
    } catch {
        // Preference persistence is best-effort.
    }
}

// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The hold-duration indicator's pure state: how long each just-played note is
// meant to keep sounding, so the on-screen key can show a shrinking fill for the
// note's written length and teach a beginner how long to hold. The matcher
// advances the instant a correct note lands, so this afterglow is tracked apart
// from it — a note's target release time in the same monotonic clock the caller
// reads frames from. No React, no clock of its own: `nowMs` arrives as a
// parameter so the whole thing is a plain function of time.

// A note ringing on its written length: struck at `startMs`, due to release at
// `endMs`, both in the caller's monotonic milliseconds.
export type Hold = { note: number; startMs: number; endMs: number };

// Start (or restart) a note's hold, replacing any hold already running for that
// note so a repeated key re-arms the full length rather than stacking. A
// non-positive duration yields an already-elapsed hold that the next prune drops.
export function beginHold(
    holds: readonly Hold[],
    note: number,
    startMs: number,
    durationMs: number,
): Hold[] {
    const others = holds.filter((hold) => hold.note !== note);
    return [...others, { note, startMs, endMs: startMs + Math.max(0, durationMs) }];
}

// Drop the holds whose release time has passed, so the animation stops re-arming
// once every note has run its length.
export function pruneHolds(holds: readonly Hold[], nowMs: number): Hold[] {
    return holds.filter((hold) => hold.endMs > nowMs);
}

// How much of the hold remains, 1 at the strike down to 0 at the release — the
// height of the shrinking fill. Clamped, so a stale `nowMs` outside the span
// can't drive the fill past full or below empty.
export function holdFraction(hold: Hold, nowMs: number): number {
    const span = hold.endMs - hold.startMs;
    if (span <= 0) {
        return 0;
    }
    return Math.min(1, Math.max(0, (hold.endMs - nowMs) / span));
}

// The remaining fraction per note for rendering — the latest hold wins when a
// note re-arms — leaving out notes whose fill has emptied.
export function holdFractionsByNote(holds: readonly Hold[], nowMs: number): Map<number, number> {
    const fractions = new Map<number, number>();
    for (const hold of holds) {
        const fraction = holdFraction(hold, nowMs);
        if (fraction > 0) {
            fractions.set(hold.note, Math.max(fractions.get(hold.note) ?? 0, fraction));
        }
    }
    return fractions;
}

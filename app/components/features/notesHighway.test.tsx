// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { keyLane } from "../../../core/keyboardGeometry";
import type { UpcomingStep } from "../../../core/matcher";
import { NotesHighway } from "./notesHighway";

afterEach(cleanup);

// A position at a moment, with each note's own written length. `holds` defaults to a
// crotchet at 120 for the cases that are not about length.
const step = (
    index: number,
    pitches: number[],
    { at = 0, staves = [0], holds }: { at?: number; staves?: number[]; holds?: number[] } = {},
): UpcomingStep => ({
    index,
    atMs: at,
    pitches,
    // One staff per pitch: a fixture that names a single staff means every note of the
    // position is on it.
    pitchStaves: pitches.map((_, note) => staves[note] ?? staves[0] ?? 0),
    // Staff 1 is the left hand in these fixtures, matching the two-staff piano layout.
    pitchHands: pitches.map((_, note) =>
        (staves[note] ?? staves[0] ?? 0) === 1 ? "left" : "right",
    ),
    staves: [...new Set(staves)],
    pitchHoldsMs: pitches.map((_, note) => holds?.[note] ?? 500),
});

// The decorative blocks carry no role; read them off the labelled panel.
function blocks(): HTMLElement[] {
    // The note blocks carry an inline lane position; the strike line (inset-x-0) does not.
    return Array.from(screen.getByRole("img").querySelectorAll<HTMLElement>("span[style*='left']"));
}

const pct = (value: string) => Number.parseFloat(value);

describe("NotesHighway", () => {
    it("renders one block per upcoming pitch", () => {
        render(<NotesHighway upcoming={[step(0, [60]), step(1, [62, 64])]} from={60} to={72} />);
        expect(blocks()).toHaveLength(3);
    });

    it("places a block in its key's lane", () => {
        render(<NotesHighway upcoming={[step(0, [62])]} from={60} to={72} />);
        const lane = keyLane(62, 60, 72)!;
        const block = blocks()[0]!;
        expect(block.style.left).toBe(`${lane.leftPct}%`);
        expect(block.style.width).toBe(`${lane.widthPct}%`);
    });

    it("draws a note as tall as it is long", () => {
        // The defect this pins: every block was one row of the panel whatever the note
        // was, so a semibreve and a semiquaver drew the same picture and the one thing a
        // falling-note view is for — length — was the one thing it could not show.
        render(
            <NotesHighway
                upcoming={[
                    step(0, [60], { holds: [2000] }),
                    step(1, [64], { at: 2000, holds: [500] }),
                ]}
                from={60}
                to={72}
                windowMs={4000}
            />,
        );
        const [whole, quarter] = blocks();
        // A semibreve is half of a four-second window, a crotchet an eighth of it.
        expect(pct(whole!.style.height)).toBeCloseTo(50 - 0.8, 1);
        expect(pct(quarter!.style.height)).toBeCloseTo(12.5 - 0.8, 1);
    });

    it("gives each note of a chord its own length", () => {
        // A whole note under a quaver is the ordinary case; reading the position off its
        // longest note draws the quaver as long as the note held beneath it.
        render(
            <NotesHighway
                upcoming={[step(0, [48, 72], { staves: [1, 0], holds: [2000, 250] })]}
                from={48}
                to={84}
                windowMs={4000}
            />,
        );
        const [held, quick] = blocks();
        expect(pct(held!.style.height)).toBeGreaterThan(pct(quick!.style.height) * 4);
    });

    it("spaces blocks by when they sound, not by how many there are", () => {
        render(
            <NotesHighway
                upcoming={[step(0, [60]), step(1, [62], { at: 250 }), step(2, [64], { at: 2000 })]}
                from={60}
                to={72}
                windowMs={4000}
            />,
        );
        const [now, soon, later] = blocks();
        expect(now!.style.bottom).toBe("0%");
        // A quaver after the first, then a minim's distance after that — the gaps differ
        // because the music does, where a row per position would space all three alike.
        expect(pct(soon!.style.bottom)).toBeCloseTo(6.25);
        expect(pct(later!.style.bottom)).toBeCloseTo(50);
    });

    it("keeps a very short note visible", () => {
        // A grace note is a handful of milliseconds and would round away to nothing.
        render(
            <NotesHighway
                upcoming={[step(0, [60], { holds: [8] })]}
                from={60}
                to={72}
                windowMs={4000}
            />,
        );
        expect(pct(blocks()[0]!.style.height)).toBeGreaterThan(0.5);
    });

    it("leaves out a note that falls beyond the panel", () => {
        // The look-ahead is counted in positions and the panel measured in time, so how
        // much of it fits is a question about the music.
        render(
            <NotesHighway
                upcoming={[step(0, [60]), step(1, [64], { at: 9000 })]}
                from={60}
                to={72}
                windowMs={4000}
            />,
        );
        expect(blocks()).toHaveLength(1);
    });

    it("colours a left-hand-only position apart from the rest", () => {
        render(
            <NotesHighway
                upcoming={[step(0, [48], { staves: [1] }), step(1, [60], { at: 500 })]}
                from={48}
                to={72}
            />,
        );
        const [left, right] = blocks();
        expect(left!.className).toContain("hand-left");
        expect(right!.className).toContain("hand-right");
    });

    it("drops pitches outside the keyboard range", () => {
        render(<NotesHighway upcoming={[step(0, [59, 60])]} from={60} to={72} />);
        // 59 is below the range; only 60 renders.
        expect(blocks()).toHaveLength(1);
    });
});

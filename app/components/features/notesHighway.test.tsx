// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { keyLane } from "../../../core/keyboardGeometry";
import type { UpcomingStep } from "../../../core/matcher";
import { NotesHighway } from "./notesHighway";

afterEach(cleanup);

const step = (index: number, pitches: number[], staves = [0]): UpcomingStep => ({
    index,
    pitches,
    staves,
});

// The decorative blocks carry no role; read them off the labelled panel.
function blocks(): HTMLElement[] {
    return Array.from(screen.getByRole("img").querySelectorAll<HTMLElement>("span"));
}

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

    it("stacks the imminent note at the floor and later notes higher", () => {
        render(
            <NotesHighway upcoming={[step(0, [60]), step(1, [62])]} from={60} to={72} rows={6} />,
        );
        const [now, next] = blocks();
        expect(now!.style.bottom).toBe("0%");
        // The second position sits one row up (100/6 %).
        expect(Number.parseFloat(next!.style.bottom)).toBeCloseTo(100 / 6);
    });

    it("colours a left-hand-only position apart from the rest", () => {
        render(
            <NotesHighway upcoming={[step(0, [48], [1]), step(1, [60], [0])]} from={48} to={72} />,
        );
        const [left, right] = blocks();
        expect(left!.className).toContain("teal");
        expect(right!.className).toContain("indigo");
    });

    it("drops pitches outside the keyboard range", () => {
        render(<NotesHighway upcoming={[step(0, [59, 60])]} from={60} to={72} />);
        // 59 is below the range; only 60 renders.
        expect(blocks()).toHaveLength(1);
    });
});

// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ScoreGrade } from "./scoreGrade";

afterEach(cleanup);

const gentle = `<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1">${[60, 62, 64]
    .map(
        (octaveStep) =>
            `<note><pitch><step>${["C", "C", "D", "D", "E"][octaveStep % 12] ?? "C"}</step><octave>4</octave></pitch><duration>2</duration></note>`,
    )
    .join("")}</measure></part></score-partwise>`;

describe("ScoreGrade", () => {
    it("shows the score's computed grade", () => {
        render(<ScoreGrade id="gentle-piece" xml={gentle} />);
        // A gentle stepwise line sits at the bottom of the piece scale.
        expect(screen.getByText("Grade 1")).toBeTruthy();
    });
});

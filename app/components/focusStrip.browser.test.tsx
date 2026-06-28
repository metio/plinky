// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { WINDOW_COLOR } from "../lib/scoreColor";
import { FocusStrip } from "./focusStrip";

afterEach(cleanup);

const ATTRS =
    "<attributes><divisions>1</divisions><clef><sign>G</sign><line>2</line></clef></attributes>";
const bar = (n: number, step: string) =>
    `<measure number="${n}">${n === 1 ? ATTRS : ""}` +
    `<note><pitch><step>${step}</step><octave>5</octave></pitch>` +
    "<duration>4</duration><type>whole</type></note></measure>";
const STEPS = Array.from({ length: 16 }, (_, i) => "CDEFGAB"[i % 7]!);
const PIECE =
    '<?xml version="1.0"?><score-partwise version="3.1"><part-list>' +
    '<score-part id="P1"><part-name>M</part-name></score-part></part-list>' +
    `<part id="P1">${STEPS.map((s, i) => bar(i + 1, s)).join("")}</part></score-partwise>`;

describe("FocusStrip", () => {
    it("renders the piece and lights the bar being played", async () => {
        // bar=4 → bars 5–6 (0-based 4–5) are the active window; scrolling to them is
        // exercised by the render but is a CSS nicety, not asserted (whole-note test
        // bars are too short to overflow the box; real pieces aren't).
        const { container } = render(<FocusStrip xml={PIECE} bar={4} label="now" />);
        const box = container.firstElementChild as HTMLElement;
        await waitFor(() => expect(box.querySelector("svg")).toBeTruthy(), { timeout: 30000 });
        await waitFor(
            () =>
                expect(box.querySelectorAll(`[fill="${WINDOW_COLOR}"]`).length).toBeGreaterThan(0),
            { timeout: 30000 },
        );
    });
});

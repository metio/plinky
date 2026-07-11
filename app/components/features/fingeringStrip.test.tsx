// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { renderWithServices } from "../../testing/renderWithServices";
import { FingeringStrip } from "./fingeringStrip";

afterEach(cleanup);

// One treble bar: C4 D4 E4 — a comfortable stepwise line the optimal fingering
// answers 1-2-3.
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>P</part-name></score-part></part-list>
  <part id="P1"><measure number="1">
    <attributes><divisions>1</divisions><key><fifths>0</fifths></key>
      <time><beats>3</beats><beat-type>4</beat-type></time>
      <clef><sign>G</sign><line>2</line></clef></attributes>
    <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
  </measure></part>
</score-partwise>`;

function renderStrip() {
    return renderWithServices(
        <FingeringStrip
            id="song-1"
            xml={XML}
            staffCount={1}
            svg={() => null}
            measureBoxes={() => []}
            renderVersion={0}
        />,
    );
}

describe("FingeringStrip", () => {
    it("opens pre-fingered with the optimal choice for every note", () => {
        renderStrip();
        // Three note chips, none showing the unassigned dot: the optimal
        // fingering seeds them all.
        expect(screen.getByText("C4")).toBeTruthy();
        expect(screen.queryByText("·")).toBeNull();
    });

    it("persists an override for the selected note and re-renders it", () => {
        const { services } = renderStrip();
        // The first note is selected on open; assign finger 5 from the right hand's row.
        fireEvent.click(screen.getByRole("button", { name: /Right — Finger 5/ }));
        const saved = services.fingering.load("song-1");
        expect(Object.values(saved)).toContain(5);
        expect(screen.getByText("C4").parentElement?.textContent).toContain("5");
    });

    it("keeps the other hand's fingers visible but inert", () => {
        renderStrip();
        const left = screen.getByRole("button", { name: /Left — Finger 3/ });
        expect(left.hasAttribute("disabled")).toBe(true);
    });
});

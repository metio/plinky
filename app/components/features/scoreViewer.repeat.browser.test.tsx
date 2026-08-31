// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { fakeMidi } from "../../adapters/fakeMidi";
import { ServicesProvider } from "../../contexts/services";
import { MidiProvider } from "../../contexts/midi";
import { ScoreViewer } from "./scoreViewer";

// What a written repeat does to the colour on the page.
//
// The second pass reads bars the first pass already painted green, so unless they are
// wiped the colour stops meaning "how far you have got" at the exact moment the score
// asks you to play the same music twice. The model rewinds — collectMatchSteps hands back
// whole = [0, 1, 0, 1, 2] for this score, pinned in useScoreMatcher.repeat.browser.test —
// and jumpsBack reads that rewind. Neither of those says the halos come off, which is the
// part somebody actually sees, and this is the test of that part.

const note = (step: string) =>
    `<note><pitch><step>${step}</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>`;

// C | D :| E — the first two bars inside a repeat, so the performance is C D C D E.
const REPEATED = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
   <measure number="1">
    <attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
    <barline location="left"><bar-style>heavy-light</bar-style><repeat direction="forward"/></barline>
    ${note("C")}
   </measure>
   <measure number="2">${note("D")}
    <barline location="right"><bar-style>light-heavy</bar-style><repeat direction="backward"/></barline>
   </measure>
   <measure number="3">${note("E")}</measure>
  </part>
</score-partwise>`;

const halos = () => document.querySelectorAll(".plinky-note-halo").length;

const strike = async (name: string) => {
    const key = await screen.findByLabelText(name);
    fireEvent.pointerDown(key);
    fireEvent.pointerUp(key);
};

afterEach(() => {
    document.body.innerHTML = "";
});

describe("a run over a written repeat", () => {
    it("wipes the bars the repeat sends the reader back over", async () => {
        render(
            <MemoryRouter>
                <ServicesProvider services={{ midi: fakeMidi() }}>
                    <MidiProvider>
                        <ScoreViewer id="repeat" xml={REPEATED} title="Repeat" credit="" />
                    </MidiProvider>
                </ServicesProvider>
            </MemoryRouter>,
        );
        const practice = await screen.findByRole(
            "button",
            { name: "Practice" },
            { timeout: 30000 },
        );
        await expect
            .poll(() => (practice as HTMLButtonElement).disabled, { timeout: 30000 })
            .toBe(false);
        fireEvent.click(practice);

        // First pass: C, then D. The page is carrying colour by now.
        await strike("C 4");
        await expect.poll(halos, { timeout: 30000 }).toBeGreaterThan(0);
        await strike("D 4");

        // Clearing that D is the moment the repeat barline sends the run back to bar one,
        // so the green from the first pass comes off and the second pass starts on a clean
        // page. Without the wipe this count only ever grows.
        await expect.poll(halos, { timeout: 30000 }).toBe(0);

        // And the run really is on the second pass rather than finished: the same two keys
        // clear again, painting the same bars a second time.
        await strike("C 4");
        await expect.poll(halos, { timeout: 30000 }).toBeGreaterThan(0);
    });
});

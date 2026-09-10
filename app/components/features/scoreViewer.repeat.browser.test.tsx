// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeMidi } from "../../adapters/fakeMidi";
import { ServicesProvider } from "../../contexts/services";
import { MidiProvider } from "../../contexts/midi";
import { m } from "../../paraglide/messages.js";
import { reveal, switchOn } from "../../testing/controls";
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

const mountRepeated = () =>
    render(
        <MemoryRouter>
            <ServicesProvider services={{ midi: fakeMidi() }}>
                <MidiProvider>
                    <ScoreViewer id="repeat" xml={REPEATED} title="Repeat" credit="" />
                </MidiProvider>
            </ServicesProvider>
        </MemoryRouter>,
    );

const awaitReady = async () => {
    const practice = await screen.findByRole("button", { name: "Practice" }, { timeout: 30000 });
    await expect
        .poll(() => (practice as HTMLButtonElement).disabled, { timeout: 30000 })
        .toBe(false);
    return practice;
};

// Noteheads the read-ahead drill has taken away. It hides with the visibility attribute,
// so the spacing and the cursor stay where they were.
const vanished = () => document.querySelectorAll('svg [visibility="hidden"]').length;

describe("the read-ahead drill over a written repeat", () => {
    it("brings back the bars the repeat sends the reader over again", async () => {
        vi.spyOn(Element.prototype, "requestFullscreen").mockResolvedValue(undefined);
        mountRepeated();
        await awaitReady();
        reveal(m.run_group_practice_title);
        fireEvent.click(screen.getByRole("switch", { name: m.sight_read() }));
        // Bars vanish by default in sight-read mode.
        expect(switchOn(m.sight_read_vanish)).toBe(true);
        fireEvent.click(await awaitReady());
        await screen.findByText(/Reading it through/);
        await expect
            .poll(() => screen.queryByText(/Reading it through/), { timeout: 30000 })
            .toBeNull();

        // The first pass: C, then D, which leaves bar one behind and takes it away.
        await strike("C 4");
        expect(vanished()).toBe(0);
        await strike("D 4");

        // Clearing that D is also where the repeat sends the run back to bar one, whose
        // C is what the player has to read next.
        await expect.poll(vanished, { timeout: 30000 }).toBe(0);

        // The second pass vanishes the bars again as it leaves them.
        await strike("C 4");
        await strike("D 4");
        await expect.poll(vanished, { timeout: 30000 }).toBeGreaterThan(0);
    });
});

// Where the visual cursor stands along the staff, in the score's own coordinates, so the
// treadmill scrolling the page does not move it.
const cursorLeft = () =>
    (document.querySelector('img[id^="cursorImg"]') as HTMLElement | null)?.style.left ?? "";

describe("a section loop over part of a written repeat", () => {
    it("keeps the cursor on the bar the loop plays next, on the second pass", async () => {
        vi.spyOn(Element.prototype, "requestFullscreen").mockResolvedValue(undefined);
        render(
            <MemoryRouter>
                <ServicesProvider services={{ midi: fakeMidi() }}>
                    <MidiProvider>
                        <ScoreViewer
                            id="repeat"
                            xml={REPEATED}
                            title="Repeat"
                            credit=""
                            options={{ loop: { from: 1, to: 1 } }}
                        />
                    </MidiProvider>
                </ServicesProvider>
            </MemoryRouter>,
        );
        fireEvent.click(await awaitReady());
        // The loop is bar one, both passes of it: C, then C again.
        await expect.poll(cursorLeft, { timeout: 30000 }).not.toBe("");
        const onBarOne = cursorLeft();

        await strike("C 4");
        await expect.poll(halos, { timeout: 30000 }).toBeGreaterThan(0);
        // The score goes on to D here and the run goes on to the second pass's C, which is
        // printed where the first one was. The cursor follows the run.
        expect(cursorLeft()).toBe(onBarOne);
    });
});

describe("a handoff from Listen on the repeat's second pass", () => {
    it("continues on the pass Listen was playing rather than the first", async () => {
        vi.spyOn(Element.prototype, "requestFullscreen").mockResolvedValue(undefined);
        mountRepeated();
        // Listen lives on the play surface, which Practice opens.
        fireEvent.click(await awaitReady());
        fireEvent.click(screen.getByRole("button", { name: "Listen" }));

        // Listen's trail and highlight cover the first pass, and on the tick the repeat
        // sends it back they come off, leaving the highlight on the second pass's C.
        await expect.poll(halos, { timeout: 30000 }).toBeGreaterThanOrEqual(2);
        await expect.poll(halos, { timeout: 30000 }).toBeLessThanOrEqual(1);
        fireEvent.click(screen.getByRole("button", { name: "Practice" }));

        // What is left of the performance is the second pass's D, then E. A run resumed
        // on the first pass would want C D again after this D, and take E as a slip.
        await strike("D 4");
        await strike("E 4");
        expect(await screen.findAllByText("Accuracy", undefined, { timeout: 30000 })).not.toEqual(
            [],
        );
    });
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

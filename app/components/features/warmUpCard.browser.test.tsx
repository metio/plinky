// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { fakeMidi } from "../../adapters/fakeMidi";
import { MidiProvider } from "../../contexts/midi";
import { ServicesProvider } from "../../contexts/services";
import { m } from "../../paraglide/messages.js";
import { ScoreViewer } from "./scoreViewer";

// The whole point of putting the offer here rather than on the front page: the key is READ
// from the score. So it has to be proved against a real engraved score in a real browser,
// not against a number handed to a pure function — the fake would agree with itself.

const NOTE = (step: string, octave: number) =>
    `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch>` +
    "<duration>4</duration><type>whole</type></note>";

const piece = (fifths: number) =>
    '<?xml version="1.0"?><score-partwise version="3.1"><part-list>' +
    '<score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1">' +
    `<measure number="1"><attributes><divisions>1</divisions><key><fifths>${fifths}</fifths></key>` +
    "<time><beats>4</beats><beat-type>4</beat-type></time>" +
    "<clef><sign>G</sign><line>2</line></clef></attributes>" +
    `${NOTE("C", 5)}</measure><measure number="2">${NOTE("D", 5)}</measure>` +
    "</part></score-partwise>";

const mount = (xml: string, id = "piece-1") =>
    render(
        <MemoryRouter>
            <ServicesProvider services={{ midi: fakeMidi() }}>
                <MidiProvider>
                    <ScoreViewer id={id} xml={xml} title="A Piece" />
                </MidiProvider>
            </ServicesProvider>
        </MemoryRouter>,
    );

afterEach(cleanup);

describe("the warm-up offered under a real score", () => {
    it("names the black keys the engraved score actually asks for", async () => {
        // Three flats. Read off the parsed score rather than inferred from the opening,
        // which was measured at near-chance accuracy and is why this lives here at all.
        mount(piece(-3));
        expect(await screen.findByText(m.warmup_card_title(), {}, { timeout: 30000 })).toBeTruthy();
        expect(screen.getByText(m.warmup_card_notes({ notes: "B♭, E♭, A♭" }))).toBeTruthy();
    });

    it("hands the piece to the drill so the drill can hand it back", async () => {
        mount(piece(2), "the-piece");
        await screen.findByText(m.warmup_card_title(), {}, { timeout: 30000 });
        const link = screen.getByRole("link", { name: /→/ });
        const href = link.getAttribute("href") ?? "";
        expect(href).toContain("then=the-piece");
        expect(href).toContain("fromTitle=A%20Piece");
    });

    it("says white keys rather than nothing when the signature is empty", async () => {
        // C major asks for no black keys, and the scale is still worth a minute — so the
        // card stays and changes what it says.
        mount(piece(0));
        expect(await screen.findByText(m.warmup_card_title(), {}, { timeout: 30000 })).toBeTruthy();
        expect(screen.getByText(m.warmup_card_white())).toBeTruthy();
    });
});

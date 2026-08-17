// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { buildScore } from "../../../core/musicxmlBuild";
import type { InstrumentRange } from "../../../core/instrumentRange";
import { fakeAudioEngine } from "../../adapters/fakeAudioEngine";
import { fakeMidi } from "../../adapters/fakeMidi";
import { memoryStore } from "../../adapters/memoryStore";
import { MidiProvider } from "../../contexts/midi";
import { ServicesProvider } from "../../contexts/services";
import { createPrefsStore } from "../../stores/prefsStore";
import { PlaySessionProvider, usePlaySession } from "./playSession";
import { PlaySurface } from "./playSurface";

// Whether a piece that reaches past the player's keys actually moves into them.
//
// The check is on what the score sounds after the fit, not on the verdict that decided it:
// the range comes back off the re-engraved sheet, so a fit that set a flag and re-engraved
// nothing would satisfy an assertion about the flag and fail this one.
//
// It runs in a browser because that reading is the thing being trusted — only OSMD knows
// what a score sounds once repeats, multiple parts and a hand mapping are accounted for.

// A 61-key controller: C2 up to C7, the commonest keyboard that is not a piano.
const SIXTY_ONE: InstrumentRange = { from: 36, to: 96 };

// Down to C1, an octave below anything a 61-key keyboard has, and no wider than one.
const TOO_LOW = buildScore({
    title: "Cellar",
    fifths: 0,
    beatsPerBar: 2,
    treble: [
        { pitch: { step: "C", octave: 2, alter: 0 }, value: "quarter" },
        { pitch: { step: "G", octave: 2, alter: 0 }, value: "quarter" },
    ],
    bass: [{ pitch: { step: "C", octave: 1, alter: 0 }, value: "half" }],
});

// Middle of the keyboard, where nothing needs doing.
const COMFORTABLE = buildScore({
    title: "Parlour",
    fifths: 0,
    beatsPerBar: 2,
    treble: [
        { pitch: { step: "E", octave: 4, alter: 0 }, value: "quarter" },
        { pitch: { step: "G", octave: 4, alter: 0 }, value: "quarter" },
    ],
    bass: [{ pitch: { step: "C", octave: 3, alter: 0 }, value: "half" }],
});

afterEach(() => {
    cleanup();
    localStorage.clear();
});

async function mount(xml: string, instrumentRange: InstrumentRange | null) {
    const store = memoryStore();
    const prefs = createPrefsStore(store);
    prefs.save({ ...prefs.load(), instrumentRange });
    seen = { shift: 0, kind: "none", sounding: "none" };
    render(
        <MemoryRouter>
            <ServicesProvider services={{ store, midi: fakeMidi(), audio: fakeAudioEngine() }}>
                <MidiProvider>
                    <PlaySessionProvider id="fit" xml={xml} title="Fit">
                        <PlaySurface />
                        <Probe />
                    </PlaySessionProvider>
                </MidiProvider>
            </ServicesProvider>
        </MemoryRouter>,
    );
    const practice = await screen.findByRole("button", { name: "Practice" }, { timeout: 30000 });
    await expect
        .poll(() => (practice as HTMLButtonElement).disabled, { timeout: 30000 })
        .toBe(false);
}

// What the session concluded, read from the session itself rather than inferred from a
// later side effect: the verdict, the shift applied, and the span the engraving sounds.
type Seen = { shift: number; kind: string; sounding: string };
let seen: Seen = { shift: 0, kind: "none", sounding: "none" };
function Probe() {
    const session = usePlaySession();
    seen = {
        shift: session.transpose,
        kind: session.instrumentFit.kind,
        sounding: session.sounding ? `${session.sounding.from}-${session.sounding.to}` : "none",
    };
    return null;
}

describe("a piece opened on a keyboard that cannot reach it", () => {
    it("moves into the keys the instrument has", async () => {
        // C1 up to G2 as written, which a keyboard starting at C2 has no key for.
        await mount(TOO_LOW, SIXTY_ONE);
        await expect.poll(() => seen.kind, { timeout: 30000 }).toBe("shifted");
        expect(seen.shift).toBe(12);
        // And the sheet really is engraved there now: an octave up, C1 and G2 become C2
        // and G3, both of them keys this keyboard has.
        await expect.poll(() => seen.sounding, { timeout: 30000 }).toBe("36-55");
    });

    it("leaves a piece that already fits exactly where it was written", async () => {
        await mount(COMFORTABLE, SIXTY_ONE);
        // C3 up to G4, comfortably inside a 61-key keyboard.
        await expect.poll(() => seen.sounding, { timeout: 30000 }).toBe("48-67");
        expect(seen.kind).toBe("fits");
        expect(seen.shift).toBe(0);
    });

    it("leaves everything alone for a player at a full piano", async () => {
        // The default, and what the scores are engraved for: nothing to fit, so a piece
        // that dips to C1 is played at C1.
        await mount(TOO_LOW, null);
        await expect.poll(() => seen.sounding, { timeout: 30000 }).toBe("24-43");
        expect(seen.kind).toBe("fits");
        expect(seen.shift).toBe(0);
    });
});

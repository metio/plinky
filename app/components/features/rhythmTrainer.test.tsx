// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { expectedOnsets, generateRhythm } from "../../../core/rhythmPattern";
import { fakeAudioEngine } from "../../adapters/fakeAudioEngine";
import { fakeMidi } from "../../adapters/fakeMidi";
import { memoryStore } from "../../adapters/memoryStore";
import { MidiProvider } from "../../contexts/midi";
import { m } from "../../paraglide/messages.js";
import { advanceScheduler } from "../../testing/advanceScheduler";
import { fakeScheduler } from "../../testing/fakeScheduler";
import { renderWithServices } from "../../testing/renderWithServices";
import { RhythmTrainer } from "./rhythmTrainer";

afterEach(cleanup);

const BPM = 60;
// Level 0 is bare quarter notes, so the rhythm is known without pinning a seed.
const LEVEL = 0;
const fixed = () => 0.5;
const PATTERN = generateRhythm(LEVEL, fixed);
const ONSETS = expectedOnsets(PATTERN, BPM);
// One lead-in plus a bar of count-in, from the component's own constants.
const UNTIL_START = 250 + PATTERN.beatsPerBar * (60_000 / BPM);

function mount() {
    const scheduler = fakeScheduler();
    const view = renderWithServices(
        <MidiProvider>
            <RhythmTrainer level={LEVEL} bpm={BPM} rng={fixed} />
        </MidiProvider>,
        { store: memoryStore(), audio: fakeAudioEngine(), midi: fakeMidi(), scheduler },
    );
    return { ...view, scheduler };
}

const start = () => fireEvent.click(screen.getByRole("button", { name: m.rhythm_start() }));
const tap = () => fireEvent.click(screen.getByRole("button", { name: m.rhythm_tap() }));

describe("RhythmTrainer", () => {
    it("counts you in before it starts listening", async () => {
        // Tapping the first note is impossible without knowing where the beat is, so the
        // run cannot begin the instant the button is pressed.
        const { scheduler } = mount();
        expect(screen.getByText(m.rhythm_ready())).toBeTruthy();
        start();
        expect(screen.getByText(m.rhythm_counting())).toBeTruthy();
        await advanceScheduler(scheduler, UNTIL_START);
        expect(screen.getByText(m.rhythm_listening())).toBeTruthy();
    });

    it("scores a rhythm tapped on the beat as bang on", async () => {
        const { scheduler } = mount();
        start();
        await advanceScheduler(scheduler, UNTIL_START);
        let at = 0;
        for (const onset of ONSETS) {
            await advanceScheduler(scheduler, onset - at);
            at = onset;
            tap();
        }
        await advanceScheduler(scheduler, 2500);
        expect(screen.getByText(m.rhythm_verdict_perfect())).toBeTruthy();
        expect(
            screen.getByText(m.rhythm_counts({ onTime: ONSETS.length, total: ONSETS.length }), {
                exact: false,
            }),
        ).toBeTruthy();
    });

    it("takes no tap before the count-in has finished", async () => {
        // A tap during the count-in is somebody finding the pulse, not playing the
        // rhythm — counting it would mark them down for getting ready.
        const { scheduler } = mount();
        start();
        await advanceScheduler(scheduler, 100);
        tap();
        await advanceScheduler(scheduler, UNTIL_START - 100);
        let at = 0;
        for (const onset of ONSETS) {
            await advanceScheduler(scheduler, onset - at);
            at = onset;
            tap();
        }
        await advanceScheduler(scheduler, 2500);
        expect(screen.getByText(m.rhythm_verdict_perfect())).toBeTruthy();
    });

    it("says a rhythm nobody tapped was missed rather than saying nothing", async () => {
        const { scheduler } = mount();
        start();
        await advanceScheduler(scheduler, UNTIL_START + ONSETS.at(-1)! + 2000);
        expect(screen.getByText(m.rhythm_verdict_off())).toBeTruthy();
        expect(
            screen.getByText(m.rhythm_missed({ count: ONSETS.length }), { exact: false }),
        ).toBeTruthy();
    });

    it("offers another go rather than leaving the result as the end of it", async () => {
        const { scheduler } = mount();
        start();
        await advanceScheduler(scheduler, UNTIL_START + ONSETS.at(-1)! + 2000);
        expect(screen.getByRole("button", { name: m.rhythm_again() })).toBeTruthy();
    });

    it("cannot be tapped before it has begun", () => {
        mount();
        expect(screen.getByRole("button", { name: m.rhythm_tap() })).toHaveProperty(
            "disabled",
            true,
        );
    });

    it("taps on the space bar, and does not restart the run doing it", async () => {
        // The key a hand resting on a desk finds first — and the one that would otherwise
        // press the Start button still holding focus, restarting the attempt half-way
        // through.
        const { scheduler } = mount();
        start();
        await advanceScheduler(scheduler, UNTIL_START);
        let at = 0;
        for (const onset of ONSETS) {
            await advanceScheduler(scheduler, onset - at);
            at = onset;
            fireEvent.keyDown(globalThis.document, { key: " " });
        }
        await advanceScheduler(scheduler, 2500);
        expect(screen.getByText(m.rhythm_verdict_perfect())).toBeTruthy();
    });

    it("does not machine-gun taps from a held key", async () => {
        // A held key repeats at the system's rate. A rhythm is tapped, not leaned on, so
        // every repeat after the first would arrive as a spare tap.
        const { scheduler } = mount();
        start();
        await advanceScheduler(scheduler, UNTIL_START);
        let at = 0;
        for (const onset of ONSETS) {
            await advanceScheduler(scheduler, onset - at);
            at = onset;
            fireEvent.keyDown(globalThis.document, { key: " " });
            fireEvent.keyDown(globalThis.document, { key: " ", repeat: true });
            fireEvent.keyDown(globalThis.document, { key: " ", repeat: true });
        }
        await advanceScheduler(scheduler, 2500);
        expect(screen.getByText(m.rhythm_verdict_perfect())).toBeTruthy();
    });

    it("ignores the space bar before the run and after it", async () => {
        const { scheduler } = mount();
        fireEvent.keyDown(globalThis.document, { key: " " });
        expect(screen.getByText(m.rhythm_ready())).toBeTruthy();
        start();
        await advanceScheduler(scheduler, UNTIL_START + ONSETS.at(-1)! + 2500);
        fireEvent.keyDown(globalThis.document, { key: " " });
        expect(screen.getByText(m.rhythm_verdict_off())).toBeTruthy();
    });
});

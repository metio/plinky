// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { DEFAULT_DRILL, generateDrill } from "../../../core/drill";
import { buildScore } from "../../../core/musicxmlBuild";
import { fakeMidi } from "../../adapters/fakeMidi";
import { MidiProvider } from "../../contexts/midi";
import { ServicesProvider } from "../../contexts/services";
import { m } from "../../paraglide/messages.js";
import { choose } from "../../testing/controls";
import { testPrefsStore } from "../../testing/stores";
import { ScoreViewer } from "./scoreViewer";

// The notes-highway reading mode covers the staff with a tall highway while playing.
// OSMD must stay mounted and drive the run underneath, so this verifies both: the
// highway appears, and a run still completes through the covered staff. OSMD renders
// only in a real browser.

const mount = (xml: string) =>
    render(
        <MemoryRouter>
            <ServicesProvider services={{ midi: fakeMidi() }}>
                <MidiProvider>
                    <ScoreViewer id="hw" xml={xml} title="Highway" />
                </MidiProvider>
            </ServicesProvider>
        </MemoryRouter>,
    );

afterEach(() => {
    cleanup();
    localStorage.clear();
});

describe("notes-highway reading mode", () => {
    it("covers the staff while playing, and the run still completes through it", async () => {
        // Turn the reading mode on (the app's prefs store reads the same localStorage).
        testPrefsStore.save({ ...testPrefsStore.load(), highway: true });
        vi.spyOn(Element.prototype, "requestFullscreen").mockResolvedValue(undefined);

        // A one-bar phrase whose every note is C5, so one key clears each position.
        const phrase = generateDrill(
            { ...DEFAULT_DRILL, bars: 1, beatsPerBar: 4, low: 72, high: 79 },
            () => 0,
        );
        mount(phrase);
        const practice = await screen.findByRole(
            "button",
            { name: "Practice" },
            { timeout: 30000 },
        );
        await expect
            .poll(() => (practice as HTMLButtonElement).disabled, { timeout: 30000 })
            .toBe(false);
        fireEvent.click(practice);

        // The highway is up once the run starts.
        expect(await screen.findByLabelText(m.highway_label())).toBeTruthy();

        // Play the four notes on the on-screen key — the matcher walks the OSMD cursor
        // hidden behind the highway, so this proves the staff still drives the run.
        const key = await screen.findByLabelText("C 5");
        for (let i = 0; i < 4; i++) {
            fireEvent.pointerDown(key);
            fireEvent.pointerUp(key);
        }
        expect(await screen.findByText("Run saved", undefined, { timeout: 30000 })).toBeTruthy();
    });

    it("draws each note as long as the engraving writes it", async () => {
        // The lengths reach the highway from a real OSMD read, and a fixture cannot tell
        // us they survive it: `writtenHoldMs` is derived per pitch while the score is
        // walked, so this is the only place the whole path — engraving to block height —
        // is exercised at once. A minim followed by quavers is the shape being read.
        testPrefsStore.save({ ...testPrefsStore.load(), highway: true });
        vi.spyOn(Element.prototype, "requestFullscreen").mockResolvedValue(undefined);

        const note = (step: string, value: "half" | "eighth") => ({
            pitch: { step, octave: 5, alter: 0 },
            value,
        });
        mount(
            buildScore({
                title: "Lengths",
                fifths: 0,
                beatsPerBar: 4,
                treble: [
                    note("C", "half"),
                    note("D", "eighth"),
                    note("E", "eighth"),
                    note("F", "eighth"),
                    note("G", "eighth"),
                ],
            }),
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

        const panel = await screen.findByLabelText(m.highway_label());
        const heights = Array.from(panel.querySelectorAll<HTMLElement>("span[style*='left']")).map(
            (block) => Number.parseFloat(block.style.height),
        );
        expect(heights.length).toBeGreaterThan(1);
        // A minim is four quavers. Anything that flattened the lengths — a row per
        // position, or reading the position's own length instead of each key's —
        // draws these the same.
        expect(heights[0]).toBeGreaterThan(heights[1]! * 3);
    });
    it("keeps the highway up when Listen takes over the music", async () => {
        // The defect this pins: Listen stops the matcher, and the highway was mounted only
        // while a graded run was practising — so pressing Listen threw away the reading
        // mode the player had chosen and dropped them back to the staff, for exactly the
        // half of the session where they are watching rather than playing.
        //
        // A real engraving, because the lookahead Listen feeds the highway is collected by
        // walking the cursor: a fake cannot show that the walk happens before Listen takes
        // the cursor over, which is the part that is easy to get wrong.
        testPrefsStore.save({ ...testPrefsStore.load(), highway: true });
        vi.spyOn(Element.prototype, "requestFullscreen").mockResolvedValue(undefined);

        const phrase = generateDrill(
            { ...DEFAULT_DRILL, bars: 1, beatsPerBar: 4, low: 72, high: 79 },
            () => 0,
        );
        mount(phrase);
        const practice = await screen.findByRole(
            "button",
            { name: "Practice" },
            { timeout: 30000 },
        );
        await expect
            .poll(() => (practice as HTMLButtonElement).disabled, { timeout: 30000 })
            .toBe(false);
        // Practice first, because Listen lives only in the full-screen bar — which is the
        // route the report came in by.
        fireEvent.click(practice);
        expect(await screen.findByLabelText(m.highway_label())).toBeTruthy();

        const listen = await screen.findByRole("button", { name: "Listen" });
        fireEvent.click(listen);

        const panel = await screen.findByLabelText(m.highway_label());
        expect(panel).toBeTruthy();
        // And it is drawing this piece's notes, not a lookahead frozen where practice
        // stopped or emptied by the matcher standing down.
        await expect
            .poll(() => panel.querySelectorAll<HTMLElement>("span[style*='left']").length, {
                timeout: 30000,
            })
            .toBeGreaterThan(0);
    });
    it("keeps the highway up when Listen is stopped again", async () => {
        // Reported after the first fix: pressing Listen kept the highway, and pressing it
        // again to stop threw it away. Nothing is moving at that moment — but the player is
        // still in full screen, mid-session, and the reading mode they chose should not
        // keep being handed back to them.
        testPrefsStore.save({ ...testPrefsStore.load(), highway: true });
        vi.spyOn(Element.prototype, "requestFullscreen").mockResolvedValue(undefined);

        const phrase = generateDrill(
            { ...DEFAULT_DRILL, bars: 1, beatsPerBar: 4, low: 72, high: 79 },
            () => 0,
        );
        mount(phrase);
        const practice = await screen.findByRole(
            "button",
            { name: "Practice" },
            { timeout: 30000 },
        );
        await expect
            .poll(() => (practice as HTMLButtonElement).disabled, { timeout: 30000 })
            .toBe(false);
        fireEvent.click(practice);
        expect(await screen.findByLabelText(m.highway_label())).toBeTruthy();

        const listen = await screen.findByRole("button", { name: "Listen" });
        fireEvent.click(listen);
        expect(await screen.findByLabelText(m.highway_label())).toBeTruthy();

        // …and off again.
        fireEvent.click(await screen.findByRole("button", { name: "Listen" }));
        expect(await screen.findByLabelText(m.highway_label())).toBeTruthy();
    });
    it("shows the highway during a tempo-locked run, and advances it", async () => {
        // Reported, and true since the highway was written: under "Keep up" it did not
        // appear at all. The highway draws the matcher's lookahead, a play-along stands the
        // matcher down, and nothing else was filling it — so there was nothing to draw and
        // no reason to appear. Both of the fixes before this one were about a highway that
        // was there; this is the mode where it never was.
        testPrefsStore.save({ ...testPrefsStore.load(), highway: true });
        vi.spyOn(Element.prototype, "requestFullscreen").mockResolvedValue(undefined);

        const phrase = generateDrill(
            { ...DEFAULT_DRILL, bars: 1, beatsPerBar: 4, low: 72, high: 79 },
            () => 0,
        );
        mount(phrase);
        const practice = await screen.findByRole(
            "button",
            { name: "Practice" },
            { timeout: 30000 },
        );
        await expect
            .poll(() => (practice as HTMLButtonElement).disabled, { timeout: 30000 })
            .toBe(false);

        // Choose the tempo-locked pace, which is what the report was made against.
        choose(m.run_pace_label(), m.keep_up_toggle());
        fireEvent.click(practice);

        const panel = await screen.findByLabelText(m.highway_label(), undefined, {
            timeout: 30000,
        });
        await expect
            .poll(() => panel.querySelectorAll("span[style*='left']").length, { timeout: 30000 })
            .toBeGreaterThan(0);

        // …and it MOVES. Appearing is not enough: priming the lookahead once would do that
        // and then stand still for the whole run, which is what a frozen picture of the
        // first four notes looks like. The blocks must follow the music.
        //
        // Their positions, specifically. The markup changes on its own as the descent time
        // is re-set each beat, so reading the whole panel would pass against a picture that
        // never moved.
        const bottoms = () =>
            Array.from(panel.querySelectorAll<HTMLElement>("span[style*='left']"))
                .map((block) => block.style.bottom)
                .join(",");
        const first = bottoms();
        await expect.poll(() => bottoms() !== first, { timeout: 30000, interval: 200 }).toBe(true);
    });
    it("lets a tempo-locked run take over from Listen, rather than doing nothing", async () => {
        // Reported. The self-paced run stops Listen and takes over; the play-along refused
        // while Listen was active and returned in silence — so under "Keep up" the button
        // was dead: press Listen, press Practice, and nothing happened at all. No run, no
        // full screen, no reason given.
        testPrefsStore.save({ ...testPrefsStore.load(), highway: true });
        vi.spyOn(Element.prototype, "requestFullscreen").mockResolvedValue(undefined);

        const phrase = generateDrill(
            { ...DEFAULT_DRILL, bars: 8, beatsPerBar: 4, low: 72, high: 79 },
            () => 0,
        );
        mount(phrase);
        const practice = await screen.findByRole(
            "button",
            { name: "Practice" },
            { timeout: 30000 },
        );
        await expect
            .poll(() => (practice as HTMLButtonElement).disabled, { timeout: 30000 })
            .toBe(false);
        choose(m.run_pace_label(), m.keep_up_toggle());
        fireEvent.click(practice);

        // Stop the play-along and start Listen instead.
        fireEvent.click(await screen.findByRole("button", { name: "Practice" }));
        const listen = await screen.findByRole("button", { name: "Listen" });
        fireEvent.click(listen);
        await expect
            .poll(() => listen.getAttribute("aria-pressed"), { timeout: 30000 })
            .toBe("true");

        // Now Practice, which should take the piece over.
        fireEvent.click(await screen.findByRole("button", { name: "Practice" }));
        await expect
            .poll(
                () => screen.getByRole("button", { name: "Practice" }).getAttribute("aria-pressed"),
                { timeout: 30000 },
            )
            .toBe("true");
        expect(screen.getByRole("button", { name: "Listen" }).getAttribute("aria-pressed")).toBe(
            "false",
        );
    });
    it("keeps the staff when Listen is pressed from the page, whatever the reading mode", async () => {
        // Reported: pressing Listen on the piece's own page put up the falling-notes
        // highway, which then misbehaved as it advanced. It should not have been there at
        // all — somebody listening from the reading page wants the score in front of them,
        // and replacing it with blocks answers a question they did not ask. The reading
        // mode belongs to the playing surface.
        testPrefsStore.save({ ...testPrefsStore.load(), highway: true });
        const phrase = generateDrill(
            { ...DEFAULT_DRILL, bars: 4, beatsPerBar: 4, low: 72, high: 79 },
            () => 0,
        );
        mount(phrase);
        const listen = await screen.findByRole("button", { name: "Listen" }, { timeout: 30000 });
        await expect
            .poll(() => (listen as HTMLButtonElement).disabled, { timeout: 30000 })
            .toBe(false);
        fireEvent.click(listen);
        await expect
            .poll(() => listen.getAttribute("aria-pressed"), { timeout: 30000 })
            .toBe("true");

        expect(screen.queryByLabelText(m.highway_label())).toBeNull();
    });
});

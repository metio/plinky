// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { fakeMidi } from "../adapters/fakeMidi";
import { memoryStore } from "../adapters/memoryStore";
import { fakeScheduler } from "../testing/fakeScheduler";
import { MidiProvider, useMidiConnection } from "./midi";
import { createServices, ServicesProvider } from "./services";

// Echoing reaches an object outside the browser, so its mistakes outlive the page: a
// release that never arrives leaves a key lit on somebody's piano with nothing left
// to clear it. These pin the cases where that can happen.

const NOTE_ON = 0x90;
const NOTE_OFF = 0x80;

afterEach(cleanup);

async function mount(echo = true) {
    const midi = fakeMidi({ outputs: ["Piano"] });
    const scheduler = fakeScheduler();
    const services = createServices({
        store: memoryStore({ "plinky:prefs": JSON.stringify({ midiEcho: echo }) }),
        midi,
        scheduler,
    });
    let api: ReturnType<typeof useMidiConnection> | null = null;
    function Probe() {
        api = useMidiConnection();
        return null;
    }
    const view = render(
        <ServicesProvider services={services}>
            <MidiProvider>
                <Probe />
            </MidiProvider>
        </ServicesProvider>,
    );
    await act(async () => {
        (api as ReturnType<typeof useMidiConnection>).requestAccess();
    });
    await act(async () => {});
    return { midi, scheduler, view, api: () => api as ReturnType<typeof useMidiConnection> };
}

describe("MIDI echo", () => {
    it("does not let a repeat cut the note still ringing", async () => {
        const { midi, scheduler, api } = await mount();

        // The same note struck again before the first has finished — a repeat, or
        // anything slurred, which sounds past its written length.
        act(() => api().echoNote(60, 100, 500));
        act(() => scheduler.advance(200));
        act(() => api().echoNote(60, 100, 500));
        act(() => scheduler.advance(320));

        // At t=520 the first note's release must NOT have fired: the second note is
        // still sounding and would be cut 180ms short.
        expect(midi.sent()).toEqual([
            [NOTE_ON, 60, 100],
            [NOTE_ON, 60, 100],
        ]);

        // It releases once, at the second note's end.
        act(() => scheduler.advance(200));
        expect(midi.sent()).toEqual([
            [NOTE_ON, 60, 100],
            [NOTE_ON, 60, 100],
            [NOTE_OFF, 60, 0],
        ]);
    });

    it("releases each note at its own end", async () => {
        const { midi, scheduler, api } = await mount();

        act(() => api().echoNote(60, 100, 200));
        act(() => api().echoNote(64, 100, 600));
        act(() => scheduler.advance(300));

        expect(midi.sent()).toContainEqual([NOTE_OFF, 60, 0]);
        expect(midi.sent()).not.toContainEqual([NOTE_OFF, 64, 0]);

        act(() => scheduler.advance(400));
        expect(midi.sent()).toContainEqual([NOTE_OFF, 64, 0]);
    });

    it("releases everything still ringing when asked", async () => {
        const { midi, scheduler, api } = await mount();

        act(() => api().echoNote(60, 100, 5000));
        act(() => api().echoNote(64, 100, 5000));
        act(() => api().silenceEcho());

        expect(midi.sent()).toContainEqual([NOTE_OFF, 60, 0]);
        expect(midi.sent()).toContainEqual([NOTE_OFF, 64, 0]);

        // …and the pending releases are gone, so nothing fires twice later.
        const after = midi.sent().length;
        act(() => scheduler.advance(10_000));
        expect(midi.sent()).toHaveLength(after);
        expect(scheduler.pending().timers).toBe(0);
    });

    it("leaves no key lit when the page goes away", async () => {
        const { midi, view, api } = await mount();

        act(() => api().echoNote(60, 100, 5000));
        view.unmount();

        // The release is a promise to hardware; unmounting must keep it, not drop it.
        expect(midi.sent()).toContainEqual([NOTE_OFF, 60, 0]);
    });

    it("sends nothing at all when the player has not asked for it", async () => {
        const { midi, api } = await mount(false);

        act(() => api().echoNote(60, 100, 500));

        expect(midi.sent()).toEqual([]);
    });

    it("drops a note no instrument could play rather than wrapping it", async () => {
        const { midi, api } = await mount();

        act(() => api().echoNote(200, 100, 500));

        expect(midi.sent()).toEqual([]);
    });
});

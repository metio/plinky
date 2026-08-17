// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { type FakeMidi, fakeMidi, fakeMidiInput } from "../../adapters/fakeMidi";
import { memoryStore } from "../../adapters/memoryStore";
import { MidiProvider, useMidiConnection } from "../../contexts/midi";
import { createPrefsStore } from "../../stores/prefsStore";
import { m } from "../../paraglide/messages.js";
import { renderWithServices } from "../../testing/renderWithServices";
import { InstrumentRangeSetting } from "./instrumentRangeSetting";

afterEach(cleanup);

const KEYSTATION = fakeMidiInput({ id: "in-1", name: "Keystation 61 MK3" });
const ANONYMOUS = fakeMidiInput({ id: "in-2", name: "USB MIDI Device" });

// A tap on the drawn keys, which the provider reports under its own device name. The
// component under test cannot press them itself, so a probe borrows the same entry point
// the on-screen keyboard uses.
let tapDrawnKey: (note: number) => void = () => {};
function OnScreenProbe() {
    const { pressKey } = useMidiConnection();
    tapDrawnKey = pressKey;
    return null;
}

async function mount(midi: FakeMidi, store = memoryStore()) {
    const view = renderWithServices(
        <MidiProvider>
            <InstrumentRangeSetting />
            <OnScreenProbe />
        </MidiProvider>,
        { midi, store },
    );
    // Devices only exist once access has been granted, which the provider does on mount
    // where the permission is already held — the fake grants it, so this is the settle.
    await waitFor(() => expect(screen.getByRole("button", { name: m.instrument_range_measure() })));
    return { ...view, prefs: createPrefsStore(store) };
}

// A note-on from a real instrument, which is the only kind that counts here.
const press = (input: typeof KEYSTATION, note: number) =>
    act(() => {
        input.emit([0x90, note, 100]);
    });

describe("InstrumentRangeSetting", () => {
    it("assumes a full piano when no instrument says otherwise", async () => {
        await mount(fakeMidi({ permission: "granted", inputs: [ANONYMOUS] }));
        expect(screen.getByText(m.instrument_range_all_keys())).toBeTruthy();
    });

    it("reads the size off a connected instrument's name, and says where it came from", async () => {
        await mount(fakeMidi({ permission: "granted", inputs: [KEYSTATION] }));
        expect(screen.getByText(m.instrument_range_keys({ count: 61 }))).toBeTruthy();
        expect(screen.getByText(`· ${m.instrument_range_from_name()}`)).toBeTruthy();
    });

    it("cannot measure what is not plugged in", async () => {
        await mount(fakeMidi({ permission: "granted", inputs: [] }));
        const measure = screen.getByRole("button", { name: m.instrument_range_measure() });
        expect((measure as HTMLButtonElement).disabled).toBe(true);
        expect(screen.getByText(m.instrument_range_no_device())).toBeTruthy();
    });

    it("measures the two keys the player presses, and keeps them", async () => {
        const { prefs } = await mount(fakeMidi({ permission: "granted", inputs: [ANONYMOUS] }));
        fireEvent.click(screen.getByRole("button", { name: m.instrument_range_measure() }));
        expect(screen.getByText(m.instrument_range_awaiting_lowest())).toBeTruthy();

        press(ANONYMOUS, 36);
        press(ANONYMOUS, 96);
        fireEvent.click(screen.getByRole("button", { name: m.action_save() }));

        expect(prefs.load().instrumentRange).toEqual({ from: 36, to: 96 });
        expect(screen.getByText(m.instrument_range_keys({ count: 61 }))).toBeTruthy();
    });

    it("takes the ends whichever order they are played in", async () => {
        const { prefs } = await mount(fakeMidi({ permission: "granted", inputs: [ANONYMOUS] }));
        fireEvent.click(screen.getByRole("button", { name: m.instrument_range_measure() }));
        press(ANONYMOUS, 96);
        press(ANONYMOUS, 36);
        fireEvent.click(screen.getByRole("button", { name: m.action_save() }));
        expect(prefs.load().instrumentRange).toEqual({ from: 36, to: 96 });
    });

    it("refuses two keys that are not the ends of anything, and asks again", async () => {
        const { prefs } = await mount(fakeMidi({ permission: "granted", inputs: [ANONYMOUS] }));
        fireEvent.click(screen.getByRole("button", { name: m.instrument_range_measure() }));
        press(ANONYMOUS, 60);
        press(ANONYMOUS, 64);
        fireEvent.click(screen.getByRole("button", { name: m.action_save() }));

        // Saved, it would leave every piece unplayable while looking like a setting.
        expect(prefs.load().instrumentRange).toBeNull();
        expect(screen.getByText(m.instrument_range_too_close())).toBeTruthy();
        expect(screen.getByText(m.instrument_range_awaiting_lowest())).toBeTruthy();
    });

    it("ignores the on-screen keyboard, which measures nothing about the room", async () => {
        await mount(fakeMidi({ permission: "granted", inputs: [ANONYMOUS] }));
        fireEvent.click(screen.getByRole("button", { name: m.instrument_range_measure() }));
        act(() => {
            tapDrawnKey(48);
        });
        expect(screen.getByText(m.instrument_range_awaiting_lowest())).toBeTruthy();
    });

    it("prefers what was measured over what the name suggests, and gives it back", async () => {
        const { prefs } = await mount(fakeMidi({ permission: "granted", inputs: [KEYSTATION] }));
        fireEvent.click(screen.getByRole("button", { name: m.instrument_range_measure() }));
        press(KEYSTATION, 48);
        press(KEYSTATION, 84);
        fireEvent.click(screen.getByRole("button", { name: m.action_save() }));
        expect(screen.getByText(m.instrument_range_keys({ count: 37 }))).toBeTruthy();

        fireEvent.click(screen.getByRole("button", { name: m.instrument_range_reset() }));
        expect(prefs.load().instrumentRange).toBeNull();
        // Back to the name's guess, not to a full piano.
        expect(screen.getByText(m.instrument_range_keys({ count: 61 }))).toBeTruthy();
    });
});

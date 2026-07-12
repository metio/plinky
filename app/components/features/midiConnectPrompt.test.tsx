// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { fakeMidi, fakeMidiInput } from "../../adapters/fakeMidi";
import { memoryStore } from "../../adapters/memoryStore";
import { MidiProvider } from "../../contexts/midi";
import { ServicesProvider } from "../../contexts/services";
import { MidiConnectPrompt } from "./midiConnectPrompt";

const mount = (midi: ReturnType<typeof fakeMidi>, children: ReactNode = <MidiConnectPrompt />) =>
    render(
        <ServicesProvider services={{ store: memoryStore(), midi }}>
            <MidiProvider>{children}</MidiProvider>
        </ServicesProvider>,
    );

afterEach(cleanup);

describe("MidiConnectPrompt", () => {
    it("offers the connect button while no device is attached", async () => {
        mount(fakeMidi());
        expect(await screen.findByRole("button", { name: "Connect MIDI" })).toBeTruthy();
    });

    it("disappears once a device is connected", async () => {
        const midi = fakeMidi({ permission: "granted", inputs: [fakeMidiInput()] });
        mount(midi);
        const button = await screen.findByRole("button", { name: "Connect MIDI" });
        fireEvent.click(button);
        await waitFor(() =>
            expect(screen.queryByRole("button", { name: "Connect MIDI" })).toBeNull(),
        );
    });

    it("shows the unsupported note where Web MIDI is absent", async () => {
        mount(fakeMidi({ supported: false }));
        expect(await screen.findByText(/does not expose the Web MIDI API/)).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Connect MIDI" })).toBeNull();
    });
});

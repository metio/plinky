// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { act, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { fakeAudioEngine } from "../adapters/fakeAudioEngine";
import { fakeMidi } from "../adapters/fakeMidi";
import { MidiProvider } from "../contexts/midi";
import { renderWithServices } from "../testing/renderWithServices";
import { useHeldPedals } from "./useHeldPedals";

afterEach(cleanup);

function Sounding() {
    useHeldPedals();
    return null;
}

// The provider mounts first and the sounding surface arrives later, the way a player
// reaches one page from another with the pedal already where they left it.
function mount() {
    const audio = fakeAudioEngine();
    const tree = (sounding: boolean) => <MidiProvider>{sounding && <Sounding />}</MidiProvider>;
    const view = renderWithServices(tree(false), { audio, midi: fakeMidi() });
    return { audio, arrive: () => view.rerender(tree(true)) };
}

describe("useHeldPedals", () => {
    it("starts the engine under a pedal already held on arrival", () => {
        const { audio, arrive } = mount();
        act(() => {
            window.__plinky?.pedal("sustain", true);
        });
        arrive();
        expect(audio.pedals).toEqual([
            { pedal: "sustain", down: true },
            { pedal: "sostenuto", down: false },
            { pedal: "soft", down: false },
        ]);
    });

    it("lifts a pedal the engine was last told was down, once the foot is up", () => {
        const { audio, arrive } = mount();
        act(() => {
            window.__plinky?.pedal("soft", true);
            window.__plinky?.pedal("soft", false);
        });
        arrive();
        expect(audio.pedals).toContainEqual({ pedal: "soft", down: false });
        expect(audio.pedals.every((move) => !move.down)).toBe(true);
    });
});

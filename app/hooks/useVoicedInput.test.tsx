// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { act, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Prefs } from "../../core/prefs";
import { fakeAudioEngine } from "../adapters/fakeAudioEngine";
import { fakeMidi } from "../adapters/fakeMidi";
import { memoryStore } from "../adapters/memoryStore";
import { MidiProvider, useMidiConnection } from "../contexts/midi";
import { createPrefsStore } from "../stores/prefsStore";
import { renderWithServices } from "../testing/renderWithServices";
import { useVoicedInput } from "./useVoicedInput";

afterEach(cleanup);

let tap: (note: number) => void = () => {};
let lift: (note: number) => void = () => {};

function Voiced() {
    useVoicedInput();
    // The entry point the drawn keys use, borrowed so a test can tap without a keybed.
    const { pressKey, releaseKey } = useMidiConnection();
    tap = pressKey;
    lift = releaseKey;
    return null;
}

function mount(patch: Partial<Prefs> = {}) {
    const audio = fakeAudioEngine();
    const store = memoryStore();
    const prefs = createPrefsStore(store);
    prefs.save({ ...prefs.load(), ...patch });
    const tree = (voiced: boolean) => <MidiProvider>{voiced && <Voiced />}</MidiProvider>;
    const view = renderWithServices(tree(true), { audio, store, prefs, midi: fakeMidi() });
    return { audio, leave: () => view.rerender(tree(false)) };
}

describe("useVoicedInput", () => {
    it("presses a voice for a tap and lets it ring on a little after", () => {
        const { audio } = mount();
        act(() => tap(64));
        expect(audio.voices).toEqual([{ kind: "press", note: 64, gain: expect.any(Number) }]);
        act(() => lift(64));
        const released = audio.voices.at(-1);
        expect(released).toMatchObject({ kind: "release", note: 64 });
        // A tap is far shorter than a key press, so its voice outlasts it.
        expect((released as { holdScale: number }).holdScale).toBeGreaterThan(1);
    });

    it("keeps a MIDI key's own articulation", () => {
        const { audio } = mount();
        act(() => {
            window.__plinky?.play(60, 100);
            window.__plinky?.release(60);
        });
        expect(audio.voices.at(-1)).toEqual({ kind: "release", note: 60, holdScale: 1 });
    });

    it("strikes harder for a harder key", () => {
        const { audio } = mount();
        act(() => {
            window.__plinky?.play(60, 40);
            window.__plinky?.play(62, 120);
        });
        const [soft, loud] = audio.voices as { gain: number }[];
        if (!soft || !loud) {
            throw new Error("expected two voices");
        }
        expect(loud.gain).toBeGreaterThan(soft.gain);
    });

    it("moves the engine's pedals with the player's", () => {
        const { audio } = mount();
        act(() => {
            window.__plinky?.pedal("sustain", true);
            window.__plinky?.pedal("soft", true);
            window.__plinky?.pedal("sustain", false);
        });
        expect(audio.pedals).toEqual([
            { pedal: "sustain", down: true },
            { pedal: "soft", down: true },
            { pedal: "sustain", down: false },
        ]);
    });

    it("sounds nothing when muted, while the pedals still track", () => {
        const { audio } = mount({ sound: false });
        act(() => {
            window.__plinky?.play(60);
            window.__plinky?.pedal("sustain", true);
        });
        expect(audio.voices.filter((voice) => voice.kind === "press")).toHaveLength(0);
        expect(audio.pedals).toEqual([{ pedal: "sustain", down: true }]);
    });

    it("stops sounding the funnel once the surface has gone", () => {
        // The funnel outlives the surface — the provider sits at the root — so a surface
        // that forgot to unsubscribe would go on sounding every page after it.
        const { audio, leave } = mount();
        leave();
        act(() => {
            window.__plinky?.play(60);
        });
        expect(window.__plinky).toBeDefined();
        expect(audio.voices).toHaveLength(0);
    });
});

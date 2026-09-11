// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { act, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Prefs } from "../../core/prefs";
import { fakeAudioEngine } from "../adapters/fakeAudioEngine";
import { fakeMidi } from "../adapters/fakeMidi";
import { fakePitch } from "../adapters/fakePitch";
import { memoryStore } from "../adapters/memoryStore";
import { MidiProvider, useMidiConnection, useMidiInput } from "../contexts/midi";
import { createPrefsStore } from "../stores/prefsStore";
import { renderWithServices } from "../testing/renderWithServices";
import { useVoicedInput } from "./useVoicedInput";

afterEach(cleanup);

let tap: (note: number) => void = () => {};
let lift: (note: number) => void = () => {};
let listen: () => void = () => {};
// Every note-on that reached the page.
let heard: number[] = [];

function Voiced() {
    useVoicedInput();
    useMidiInput({ onNoteOn: (event) => heard.push(event.note) });
    // The entry points the drawn keys and the microphone button use, borrowed so a test
    // can tap or listen without a keybed.
    const { pressKey, releaseKey, startMic } = useMidiConnection();
    tap = pressKey;
    lift = releaseKey;
    listen = startMic;
    return null;
}

function mount(patch: Partial<Prefs> = {}) {
    heard = [];
    const audio = fakeAudioEngine();
    const pitch = fakePitch();
    const store = memoryStore();
    const prefs = createPrefsStore(store);
    prefs.save({ ...prefs.load(), ...patch });
    const tree = (voiced: boolean) => <MidiProvider>{voiced && <Voiced />}</MidiProvider>;
    const view = renderWithServices(tree(true), { audio, pitch, store, prefs, midi: fakeMidi() });
    return { audio, pitch, leave: () => view.rerender(tree(false)) };
}

const presses = (audio: ReturnType<typeof fakeAudioEngine>) =>
    audio.voices.filter((voice) => voice.kind === "press").map((voice) => voice.note);

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

    it("starts the engine where the player's pedals are", () => {
        const { audio } = mount();
        expect(audio.pedals).toEqual([
            { pedal: "sustain", down: false },
            { pedal: "sostenuto", down: false },
            { pedal: "soft", down: false },
        ]);
    });

    it("moves the engine's pedals with the player's", () => {
        const { audio } = mount();
        audio.pedals.length = 0;
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
        audio.pedals.length = 0;
        act(() => {
            window.__plinky?.play(60);
            window.__plinky?.pedal("sustain", true);
        });
        expect(presses(audio)).toEqual([]);
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

describe("the sources that already make their own sound", () => {
    it("never voices a note the microphone heard, whatever the instrument setting", () => {
        // The microphone hears a piano that is already sounding in the room, so a voice
        // would double it, and the speaker's copy would trip the echo guard on the
        // player's next strike of that pitch.
        for (const instrumentSounds of [false, true]) {
            const { audio, pitch } = mount({ instrumentSounds });
            act(() => listen());
            act(() => {
                pitch.emit({ kind: "on", note: 60, velocity: 80 });
                pitch.emit({ kind: "off", note: 60 });
            });
            expect(presses(audio)).toEqual([]);
            cleanup();
        }
    });

    it("hears a repeated note on the microphone as two notes", () => {
        // The failure the rule prevents, end to end: were the first C voiced, the engine
        // would report it recently struck, and the second, real C would be dropped as the
        // speaker's echo before the page ever heard it.
        const { audio, pitch } = mount();
        const struck = new Set<number>();
        audio.recentlyStruck = (note) => struck.has(note);
        const press = audio.press;
        audio.press = (note, gain, velocity) => {
            struck.add(note);
            press(note, gain, velocity);
        };
        act(() => listen());
        act(() => {
            pitch.emit({ kind: "on", note: 60, velocity: 80 });
            pitch.emit({ kind: "off", note: 60 });
            pitch.emit({ kind: "on", note: 60, velocity: 80 });
        });
        expect(heard).toEqual([60, 60]);
    });

    it("still voices a tap while the microphone listens", () => {
        const { audio } = mount();
        act(() => listen());
        act(() => tap(64));
        expect(presses(audio)).toEqual([64]);
    });

    it("leaves a MIDI piano that sounds on its own to itself, and still answers a tap", () => {
        const { audio } = mount({ instrumentSounds: true });
        act(() => {
            window.__plinky?.play(60);
            window.__plinky?.release(60);
            tap(64);
        });
        expect(presses(audio)).toEqual([64]);
    });

    it("voices a silent MIDI controller", () => {
        const { audio } = mount({ instrumentSounds: false });
        act(() => window.__plinky?.play(60));
        expect(presses(audio)).toEqual([60]);
    });
});

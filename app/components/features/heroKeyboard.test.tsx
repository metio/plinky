// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { namingFor, pitchLabelIn } from "../../../core/noteNaming";
import {
    HOME_OCTAVE,
    type MethodId,
    METHODS,
    type PracticeMethod,
} from "../../../core/practiceMethods";
import { fakeAudioEngine } from "../../adapters/fakeAudioEngine";
import { fakeMidi } from "../../adapters/fakeMidi";
import { MidiProvider, useMidiConnection } from "../../contexts/midi";
import { m } from "../../paraglide/messages.js";
import { renderWithServices } from "../../testing/renderWithServices";
import { noteWords } from "../ui/noteWords";
import { HeroKeyboard } from "./heroKeyboard";
import { METHOD_LABEL, METHOD_NAME } from "./practiceMethods";

afterEach(cleanup);

// A note from anywhere but the drawn keys: what a MIDI piano or the computer keys send,
// pressed straight into the input funnel.
function Funnel({ note }: { note: number }) {
    const { pressKey, releaseKey } = useMidiConnection();
    return (
        <>
            <button type="button" onClick={() => pressKey(note)}>
                funnel on
            </button>
            <button type="button" onClick={() => releaseKey(note)}>
                funnel off
            </button>
        </>
    );
}

const mount = (funnelNote = 60) => {
    const audio = fakeAudioEngine();
    const tree = (shown: boolean) => (
        <MemoryRouter>
            <MidiProvider>
                <Funnel note={funnelNote} />
                {shown && <HeroKeyboard />}
            </MidiProvider>
        </MemoryRouter>
    );
    const view = renderWithServices(tree(true), { audio, midi: fakeMidi() });
    return {
        audio,
        services: view.services,
        hide: () => view.rerender(tree(false)),
    };
};

const method = (id: MethodId): PracticeMethod => {
    const found = METHODS.find((candidate) => candidate.id === id);
    if (!found) {
        throw new Error(`no method ${id}`);
    }
    return found;
};
const keybed = () => screen.getByRole("group", { name: m.keyboard_label() });
const keyFor = (id: MethodId) =>
    within(keybed()).getByRole("button", { name: (name) => name.includes(METHOD_NAME[id]()) });
const undressedKeys = () =>
    within(keybed())
        .getAllByRole("button")
        .filter((key) => !key.hasAttribute("aria-controls"));
const leafFor = (id: MethodId) => screen.getByRole("region", { name: METHOD_NAME[id]() });
const presses = (audio: ReturnType<typeof fakeAudioEngine>) =>
    audio.voices.filter((voice) => voice.kind === "press").map((voice) => voice.note);

describe("HeroKeyboard", () => {
    it("is one octave, C to B: a method on each white key, and five black keys", () => {
        mount();
        expect(within(keybed()).getAllByRole("button")).toHaveLength(12);
        const leafId = leafFor("chunking").id;
        for (const { id } of METHODS) {
            const key = keyFor(id);
            // The word printed on the key leads its name, then the method it opens.
            expect(key.getAttribute("aria-label")?.startsWith(METHOD_LABEL[id]())).toBe(true);
            expect(key.getAttribute("aria-controls")).toBe(leafId);
        }
        expect(undressedKeys()).toHaveLength(5);
    });

    it("prints no note name, whatever the player set, and still says the pitch", () => {
        const { services } = mount();
        act(() => {
            services.prefs.save({ ...services.prefs.load(), noteLabels: "all" });
        });
        const naming = namingFor("all", "en");
        const words = noteWords("en");
        for (let note = HOME_OCTAVE.from; note <= HOME_OCTAVE.to; note++) {
            const printed = pitchLabelIn(note, naming.system, words);
            expect(within(keybed()).queryAllByText(printed)).toHaveLength(0);
        }
        // The spoken name is untouched: every key still names its pitch and octave.
        const named = within(keybed())
            .getAllByRole("button")
            .map((key) => key.getAttribute("aria-label") ?? "");
        expect(named.filter((label) => label.includes("C 4"))).toHaveLength(1);
        expect(named.filter((label) => label.includes("C sharp 4"))).toHaveLength(1);
    });

    it("opens the first key's method before anything is pressed", () => {
        mount();
        expect(screen.getAllByRole("region")).toHaveLength(1);
        expect(leafFor("chunking")).toBeTruthy();
        for (const { id } of METHODS) {
            expect(keyFor(id).getAttribute("aria-expanded")).toBe(String(id === "chunking"));
        }
    });

    it("sounds a white key and opens its method below", () => {
        const { audio } = mount();
        fireEvent.pointerDown(keyFor("handsApart"));
        expect(presses(audio)).toEqual([method("handsApart").key]);
        expect(leafFor("handsApart")).toBeTruthy();
        expect(keyFor("handsApart").getAttribute("aria-expanded")).toBe("true");
        expect(keyFor("chunking").getAttribute("aria-expanded")).toBe("false");
        fireEvent.pointerUp(keyFor("handsApart"));
    });

    it("sounds a black key and leaves the open method where it was", () => {
        const { audio } = mount();
        const [black] = undressedKeys();
        if (!black) {
            throw new Error("no black key");
        }
        fireEvent.pointerDown(black);
        expect(presses(audio)).toHaveLength(1);
        expect(leafFor("chunking")).toBeTruthy();
    });

    it("opens a method from the keyboard too, and keeps the focus on the key", () => {
        const { audio } = mount();
        const key = keyFor("spacing");
        key.focus();
        fireEvent.keyDown(key, { key: "Enter" });
        expect(presses(audio)).toEqual([method("spacing").key]);
        expect(leafFor("spacing")).toBeTruthy();
        expect(document.activeElement).toBe(key);
        fireEvent.keyUp(key, { key: "Enter" });
    });

    it("opens the method on the key a MIDI note plays", () => {
        mount(method("chords").key);
        fireEvent.click(screen.getByText("funnel on"));
        expect(leafFor("chords")).toBeTruthy();
        expect(keyFor("chords").getAttribute("aria-pressed")).toBe("true");
    });

    it("opens the method on the key a computer key plays", () => {
        const { audio } = mount();
        // The left hand's E: the left hand's row starts on the same middle C the drawn
        // octave does.
        fireEvent.keyDown(window, { key: "c", code: "KeyC" });
        const [note] = presses(audio);
        expect(note).toBe(method("handsApart").key);
        expect(leafFor("handsApart")).toBeTruthy();
        fireEvent.keyUp(window, { key: "c", code: "KeyC" });
    });

    it("sounds a MIDI note outside the octave and opens nothing for it", () => {
        const { audio } = mount(48);
        fireEvent.click(screen.getByText("funnel on"));
        expect(presses(audio)).toEqual([48]);
        expect(leafFor("chunking")).toBeTruthy();
    });

    it("lights a key while it is held", () => {
        mount();
        const key = keyFor("slow");
        fireEvent.pointerDown(key);
        expect(key.className).toContain("bg-success-fill");
    });

    it("ends the voice of a key still held down when the hero goes", () => {
        // The drawn keys let a held key go as they unmount, and that release reaches the
        // funnel only after the hero has stopped listening to it, so the hero has to end
        // the voice itself.
        const { audio, hide } = mount();
        fireEvent.pointerDown(keyFor("chunking"));
        expect(audio.voices).toEqual([{ kind: "press", note: 60, gain: expect.any(Number) }]);
        hide();
        expect(audio.voices.at(-1)).toMatchObject({ kind: "release", note: 60 });
    });
});

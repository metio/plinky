// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { fakeAudioEngine } from "../../adapters/fakeAudioEngine";
import { fakeMidi } from "../../adapters/fakeMidi";
import { MidiProvider } from "../../contexts/midi";
import { ServicesProvider } from "../../contexts/services";
import { m } from "../../paraglide/messages.js";
import { HeroKeyboard } from "./heroKeyboard";
import { METHOD_NAME } from "./practiceMethods";

// In a real browser: real layout, real pointer events and real focus. The notes go to the
// fake audio engine so they can be read back, and MIDI goes through the fake seam, since
// this project grants no MIDI permission.
const mount = () => {
    const audio = fakeAudioEngine();
    render(
        <MemoryRouter>
            <ServicesProvider services={{ midi: fakeMidi(), audio }}>
                <MidiProvider>
                    <HeroKeyboard />
                </MidiProvider>
            </ServicesProvider>
        </MemoryRouter>,
    );
    return audio;
};

const keybed = () => screen.getByRole("group", { name: m.keyboard_label() });

afterEach(cleanup);

describe("the front page's keyboard in a real browser", () => {
    it("opens a key's method below and plays its note when the key is pressed", async () => {
        const audio = mount();
        const key = screen.getByRole("button", {
            name: (name) => name.includes(METHOD_NAME.hearingFirst()),
        });
        const box = key.getBoundingClientRect();
        fireEvent.pointerDown(key, {
            pointerId: 1,
            pointerType: "mouse",
            clientX: box.left + box.width / 2,
            clientY: box.bottom - 8,
        });
        const leaf = await screen.findByRole("region", { name: METHOD_NAME.hearingFirst() });
        expect(leaf).toBeTruthy();
        expect(audio.voices).toContainEqual(expect.objectContaining({ kind: "press", note: 65 }));
        expect(key.getAttribute("aria-expanded")).toBe("true");
        fireEvent.pointerUp(key, { pointerId: 1, pointerType: "mouse" });
        expect(audio.voices.at(-1)).toMatchObject({ kind: "release", note: 65 });
    });

    it("draws each method's picture inside its key, clear of the black keys", () => {
        mount();
        const dressed = [...keybed().querySelectorAll<HTMLElement>("[aria-controls]")];
        expect(dressed).toHaveLength(7);
        const blackBottom = Math.max(
            ...[...keybed().querySelectorAll<HTMLElement>("button:not([aria-controls])")].map(
                (key) => key.getBoundingClientRect().bottom,
            ),
        );
        for (const key of dressed) {
            const picture = key.querySelector("svg");
            expect(picture).not.toBeNull();
            const art = (picture as SVGElement).getBoundingClientRect();
            const face = key.getBoundingClientRect();
            expect(art.width).toBeGreaterThan(0);
            expect(art.left).toBeGreaterThanOrEqual(face.left);
            expect(art.right).toBeLessThanOrEqual(face.right);
            // Below the black keys, where a finger lands on the white key itself.
            expect(art.top).toBeGreaterThanOrEqual(blackBottom);
        }
    });
});

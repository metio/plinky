// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { entryById, GLOSSARY, performSnippet } from "../../core/glossary";
import { fakeAudioEngine } from "../adapters/fakeAudioEngine";
import { memoryStore } from "../adapters/memoryStore";
import { m } from "../paraglide/messages.js";
import { symbolName } from "../lib/glossaryLabels";
import { renderWithServices } from "../testing/renderWithServices";
import Glossary from "./glossary";

// The drawing engine only runs in a real browser; the browser test covers that the
// example actually renders. Here the notation is a stub, so what is under test is the
// surface around it — which symbol is selected, and what reaches the speakers.
vi.mock("../components/features/notationExample", () => ({
    NotationExample: ({ label }: { label: string }) => <div data-example={label} />,
}));

// A missing entry means the catalogue changed under the test; failing loudly beats
// quietly asserting against some other symbol.
function must(id: string) {
    const entry = entryById(id);
    if (!entry) {
        throw new Error(`no glossary entry called ${id}`);
    }
    return entry;
}

afterEach(cleanup);

function mount() {
    const audio = fakeAudioEngine();
    const view = renderWithServices(
        <MemoryRouter>
            <Glossary />
        </MemoryRouter>,
        { store: memoryStore(), audio },
    );
    return { audio, ...view };
}

describe("Glossary", () => {
    it("opens on the first symbol with every symbol listed", () => {
        mount();

        expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(m.glossary_title());
        // Every symbol is reachable without opening anything, and each one is named —
        // an entry added to the catalogue with no translated name would show its id here.
        for (const entry of GLOSSARY) {
            const name = symbolName(entry.id);
            expect(`${entry.id}: ${name}`).not.toBe(`${entry.id}: ${entry.id}`);
            expect(screen.getByRole("button", { name })).toBeTruthy();
        }
    });

    it("marks the selected symbol and swaps the reading when another is chosen", () => {
        mount();

        const staccato = screen.getByRole("button", { name: m.glossary_staccato_name() });
        fireEvent.click(staccato);

        expect(staccato.getAttribute("aria-current")).toBe("true");
        expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
            m.glossary_staccato_name(),
        );
        expect(screen.getByText(m.glossary_staccato_gloss())).toBeTruthy();
    });

    it("offers the plain reading only where the mark changes the sound", () => {
        mount();

        // Staccato clips the notes, so there is something to compare.
        fireEvent.click(screen.getByRole("button", { name: m.glossary_staccato_name() }));
        expect(screen.queryByRole("button", { name: m.glossary_hear_plain() })).toBeTruthy();

        // A slur instructs the hands and leaves the written lengths alone, so it does not
        // pretend to have a "without" reading.
        fireEvent.click(screen.getByRole("button", { name: m.glossary_slur_name() }));
        expect(screen.queryByRole("button", { name: m.glossary_hear_plain() })).toBeNull();
        expect(screen.queryByRole("button", { name: m.glossary_hear() })).toBeTruthy();
    });

    it("sounds the example's notes when asked to play it", () => {
        const view = mount();

        fireEvent.click(screen.getByRole("button", { name: m.glossary_staccato_name() }));
        fireEvent.click(screen.getByRole("button", { name: m.glossary_hear() }));

        expect(view.audio.strikes.map((strike) => strike.note)).toEqual(
            performSnippet(must("staccato").shown).map((strike) => strike.note),
        );
    });

    it("plays the plain reading differently from the marked one", () => {
        const view = mount();

        fireEvent.click(screen.getByRole("button", { name: m.glossary_accent_name() }));
        fireEvent.click(screen.getByRole("button", { name: m.glossary_hear() }));
        const marked = [...view.audio.strikes];
        view.audio.strikes.length = 0;
        fireEvent.click(screen.getByRole("button", { name: m.glossary_hear_plain() }));

        // The accent is a loudness mark, so the two readings differ in how hard the
        // notes are struck rather than in which notes they are.
        expect(view.audio.strikes.map((strike) => strike.note)).toEqual(
            marked.map((strike) => strike.note),
        );
        expect(view.audio.strikes.map((strike) => strike.gain)).not.toEqual(
            marked.map((strike) => strike.gain),
        );
    });

    it("describes the notation for a reader who cannot see it", () => {
        mount();

        // The engine draws a thicket of SVG paths; the label is what a screen reader
        // gets instead.
        expect(document.querySelector("[data-example]")?.getAttribute("data-example")).toBe(
            m.glossary_dotted_gloss(),
        );
    });
});

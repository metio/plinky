// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useNavigate } from "react-router";
import { entryById, GLOSSARY, performSnippet } from "../../core/glossary";
import { fakeAudioEngine } from "../adapters/fakeAudioEngine";
import { memoryStore } from "../adapters/memoryStore";
import { advanceScheduler } from "../testing/advanceScheduler";
import { fakeScheduler } from "../testing/fakeScheduler";
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

function mountAt(search: string) {
    const audio = fakeAudioEngine();
    const scheduler = fakeScheduler();
    return renderWithServices(
        <MemoryRouter initialEntries={[`/en/glossary/${search}`]}>
            <Glossary />
        </MemoryRouter>,
        { store: memoryStore(), audio, scheduler },
    );
}

function mount() {
    const audio = fakeAudioEngine();
    const scheduler = fakeScheduler();
    const view = renderWithServices(
        <MemoryRouter>
            <Glossary />
        </MemoryRouter>,
        { store: memoryStore(), audio, scheduler },
    );
    return { audio, scheduler, ...view };
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

    it("opens the symbol a piece sent the reader here to look up", () => {
        // The run-setup panel links the marks a piece uses as /glossary/?symbol=<id>.
        // Arriving on that link has to land on the answer rather than on the first
        // entry with the answer somewhere below.
        mountAt("?symbol=staccato");

        expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
            m.glossary_staccato_name(),
        );
        expect(
            screen
                .getByRole("button", { name: m.glossary_staccato_name() })
                .getAttribute("aria-current"),
        ).toBe("true");
    });

    it("opens the first symbol when the link names one that does not exist", () => {
        // A stale link from an older build must not land on a blank page.
        mountAt("?symbol=nonsense");

        expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
            symbolName(GLOSSARY[0]?.id ?? "slur"),
        );
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

    it("plays the plain reading differently from the marked one", async () => {
        const view = mount();

        fireEvent.click(screen.getByRole("button", { name: m.glossary_accent_name() }));
        fireEvent.click(screen.getByRole("button", { name: m.glossary_hear() }));
        const marked = [...view.audio.strikes];
        view.audio.strikes.length = 0;
        // The reader hears one phrase out before the other, which is what makes it a
        // comparison rather than a chord.
        await advanceScheduler(view.scheduler, 60_000);
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

    it("names the notation for a reader who cannot see it, without repeating the gloss", () => {
        mount();

        // The engine draws a thicket of SVG paths, so the picture needs a label — but the
        // gloss is already on the page as text directly above it, and labelling the image
        // with the same sentence would read it out twice.
        const label = document.querySelector("[data-example]")?.getAttribute("data-example");
        expect(label).toBe(m.glossary_dotted_name());
        expect(label).not.toBe(m.glossary_dotted_gloss());
    });

    it("rests the buttons until the phrase has finished sounding", async () => {
        // Strikes are scheduled ahead on the audio clock, so a second press mid-phrase
        // would lay one reading over the other — and the pair is the whole explanation.
        const view = mount();
        fireEvent.click(screen.getByRole("button", { name: m.glossary_staccato_name() }));
        const hear = screen.getByRole("button", { name: m.glossary_hear() });

        fireEvent.click(hear);
        const struck = view.audio.strikes.length;
        expect(struck).toBeGreaterThan(0);
        expect(hear.hasAttribute("disabled")).toBe(true);
        expect(
            screen.getByRole("button", { name: m.glossary_hear_plain() }).hasAttribute("disabled"),
        ).toBe(true);

        // A press while it rests adds nothing.
        fireEvent.click(hear);
        expect(view.audio.strikes).toHaveLength(struck);

        // Once the phrase is over, it can be heard again.
        await advanceScheduler(view.scheduler, 60_000);
        expect(
            screen.getByRole("button", { name: m.glossary_hear() }).hasAttribute("disabled"),
        ).toBe(false);
    });

    it("silences the phrase still sounding when another symbol is chosen, and on leaving", async () => {
        // The rest timer is JS and the strikes are on the audio clock: freeing the buttons
        // without silencing the clock laid the old reading under the new one.
        const view = mount();
        fireEvent.click(screen.getByRole("button", { name: m.glossary_hear() }));
        const silenced = () => view.audio.silenced;
        const before = silenced();
        fireEvent.click(screen.getByRole("button", { name: m.glossary_accent_name() }));
        expect(silenced()).toBeGreaterThan(before);
        const after = silenced();
        view.unmount();
        expect(silenced()).toBeGreaterThan(after);
    });

    it("follows the address through history, not only on arrival", () => {
        // Two links into the glossary, then Back: the route stays mounted across the
        // entries, so a selection seeded once at mount showed the wrong symbol under the
        // right address.
        const audio = fakeAudioEngine();
        const scheduler = fakeScheduler();
        function Back() {
            const navigate = useNavigate();
            return (
                <button type="button" onClick={() => navigate(-1)}>
                    back
                </button>
            );
        }
        renderWithServices(
            <MemoryRouter
                initialEntries={["/en/glossary/?symbol=slur", "/en/glossary/?symbol=staccato"]}
                initialIndex={1}
            >
                <Back />
                <Glossary />
            </MemoryRouter>,
            { store: memoryStore(), audio, scheduler },
        );
        expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
            m.glossary_staccato_name(),
        );
        fireEvent.click(screen.getByRole("button", { name: "back" }));
        expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(m.glossary_slur_name());
    });

    it("frees the buttons at once when another symbol is chosen", async () => {
        // The phrase still ringing belongs to a symbol no longer on screen, so waiting it
        // out would leave the new symbol's buttons dead for no reason the reader can see.
        const view = mount();
        fireEvent.click(screen.getByRole("button", { name: m.glossary_staccato_name() }));
        fireEvent.click(screen.getByRole("button", { name: m.glossary_hear() }));
        expect(
            screen.getByRole("button", { name: m.glossary_hear() }).hasAttribute("disabled"),
        ).toBe(true);

        fireEvent.click(screen.getByRole("button", { name: m.glossary_accent_name() }));

        expect(
            screen.getByRole("button", { name: m.glossary_hear() }).hasAttribute("disabled"),
        ).toBe(false);
        // And the timer it cancelled is not left behind to fire later.
        expect(view.scheduler.pending().timers).toBe(0);
    });

    it("moves focus to the symbol it just opened", () => {
        // On a phone the index is taller than the screen, so this pane is under the fold:
        // a tap would change a screenful the reader cannot see. Focus scrolls it into
        // view and tells a screen reader what it landed on.
        mount();
        const heading = screen.getByRole("heading", { level: 2 });
        expect(document.activeElement).not.toBe(heading);

        fireEvent.click(screen.getByRole("button", { name: m.glossary_slur_name() }));

        expect(document.activeElement).toBe(screen.getByRole("heading", { level: 2 }));
    });

    it("leaves focus alone on arrival", () => {
        // Only choosing a symbol moves focus; landing on the page must not yank the
        // reader out of the document flow.
        mount();

        expect(document.activeElement).toBe(document.body);
    });
});

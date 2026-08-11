// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { buildSnippet, type Snippet } from "../../../core/glossaryScore";
import { m } from "../../paraglide/messages.js";
import { ScoreSymbols } from "./scoreSymbols";

afterEach(cleanup);

const piece = (notes: Snippet["notes"], over: Partial<Snippet> = {}) =>
    buildSnippet({ clef: "treble", fifths: 0, beatsPerBar: 4, notes, ...over });

function mount(xml: string) {
    return render(
        <MemoryRouter>
            <ScoreSymbols xml={xml} />
        </MemoryRouter>,
    );
}

describe("ScoreSymbols", () => {
    it("names each mark the piece uses and links it to the glossary", () => {
        mount(
            piece([
                { step: "C", octave: 5, value: "quarter", articulation: "staccato" },
                { step: "D", octave: 5, value: "quarter" },
                { step: "E", octave: 5, value: "half" },
            ]),
        );

        const link = screen.getByRole("link", { name: m.glossary_staccato_name() });
        // The link opens the glossary on this symbol, so the reader lands on the answer
        // rather than at the top of a list of twelve.
        expect(link.getAttribute("href")).toContain("symbol=staccato");
        expect(screen.getByText(m.score_symbols_title())).toBeTruthy();
        expect(screen.getByText(new RegExp(m.glossary_staccato_gloss()))).toBeTruthy();
    });

    it("says nothing about a piece with nothing unusual in it", () => {
        // A beginner tune of plain quarter notes should not sprout a heading promising
        // something to learn.
        const { container } = mount(
            piece([
                { step: "C", octave: 5, value: "half" },
                { step: "D", octave: 5, value: "half" },
            ]),
        );

        expect(container.textContent).toBe("");
    });

    it("lists the marks in the glossary's order, not the order they occur", () => {
        // Grouped by what each mark controls — how long, how you touch it, how loud —
        // so the list reads the same way the reference does.
        mount(
            piece([
                { step: "C", octave: 5, value: "quarter", dynamic: "f" },
                { step: null, value: "quarter" },
                { step: "D", octave: 5, value: "half", articulation: "staccato" },
            ]),
        );

        const names = screen.getAllByRole("link").map((link) => link.textContent);
        expect(names).toEqual([
            m.glossary_rest_name(),
            m.glossary_staccato_name(),
            m.glossary_forte_name(),
        ]);
    });
});

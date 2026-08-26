// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LinkedText, slot } from "./linkedText";

afterEach(cleanup);

describe("LinkedText", () => {
    it("puts an element where the sentence asks for one", () => {
        render(
            <LinkedText
                text={`Read the ${slot("glossary")} for that.`}
                links={{ glossary: <a href="/glossary">glossary</a> }}
            />,
        );

        expect(screen.getByRole("link", { name: "glossary" })).toBeTruthy();
        expect(screen.getByText(/Read the/)).toBeTruthy();
        expect(screen.getByText(/for that\./)).toBeTruthy();
    });

    it("follows the sentence's own word order, wherever the slot falls", () => {
        // The reason this exists rather than three message keys: a language that puts the
        // link first must be able to, and a translator who moves it must not have to
        // change any code.
        render(
            <LinkedText
                text={`${slot("tools")} sind da, wenn du etwas ausprobieren willst.`}
                links={{ tools: <a href="/tools">Kleine Werkzeuge</a> }}
            />,
        );

        const paragraph = screen.getByRole("link", { name: "Kleine Werkzeuge" }).parentElement;
        expect(paragraph?.textContent).toBe(
            "Kleine Werkzeuge sind da, wenn du etwas ausprobieren willst.",
        );
    });

    it("fills several slots in one sentence", () => {
        render(
            <LinkedText
                text={`${slot("one")} and ${slot("two")}`}
                links={{ one: <a href="/1">one</a>, two: <a href="/2">two</a> }}
            />,
        );

        expect(screen.getAllByRole("link")).toHaveLength(2);
    });

    it("leaves a slot nobody filled visible rather than swallowing it", () => {
        // A sentence quietly missing a word is harder to notice than one with a marker
        // sitting in the middle of it.
        render(<LinkedText text={`Read the ${slot("glossary")}.`} links={{}} />);

        expect(screen.getByText(/\[\[glossary\]\]/)).toBeTruthy();
    });

    it("renders a sentence with no slots unchanged", () => {
        const { container } = render(<LinkedText text="Nothing to link here." links={{}} />);

        expect(container.textContent).toBe("Nothing to link here.");
    });
});

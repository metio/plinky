// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { markLearned } from "../../../core/mastery";
import { memoryStore } from "../../adapters/memoryStore";
import { createMasteryStore } from "../../stores/masteryStore";
import { renderWithServices } from "../../testing/renderWithServices";

import { BacklogButton } from "./backlogButton";

afterEach(cleanup);

describe("BacklogButton", () => {
    it("renders nothing until a piece is learned — only a learned piece can be shelved", () => {
        const { container } = renderWithServices(<BacklogButton id="fresh" />);
        expect(container.querySelector("button")).toBeNull();
    });

    it("shelves a learned piece and brings it back, its label tracking the store", () => {
        const kv = memoryStore();
        const mastery = createMasteryStore(kv);
        mastery.save("piece", markLearned(null, Date.now()));
        renderWithServices(<BacklogButton id="piece" />, { store: kv, mastery });

        // Learned but not shelved: the control offers to move it to the backlog.
        const button = () => screen.getByRole("button");
        expect(button().getAttribute("aria-label")).toBe("Move to backlog");
        expect(button().getAttribute("aria-pressed")).toBe("false");

        fireEvent.click(button());
        expect(mastery.load("piece")?.backlog).toBe(true);
        // Shelved: pressed, and now the control resumes reviews instead.
        expect(button().getAttribute("aria-pressed")).toBe("true");
        expect(button().getAttribute("aria-label")).toBe("Resume reviews");

        fireEvent.click(button());
        expect(mastery.load("piece")?.backlog).toBe(false);
    });
});

// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { markLearned } from "../../../core/mastery";
import { memoryStore } from "../../adapters/memoryStore";
import { createMasteryStore } from "../../stores/masteryStore";
import { renderWithServices } from "../../testing/renderWithServices";

import { MarkLearnedButton } from "./markLearnedButton";

afterEach(cleanup);

describe("MarkLearnedButton", () => {
    it("toggles a piece learned and back, its label and pressed state tracking the store", () => {
        const { services } = renderWithServices(<MarkLearnedButton id="btn-click" />);
        const button = () => screen.getByRole("button", { name: /learned/i });
        // Not learned: an unpressed "Mark learned" control.
        expect(button().getAttribute("aria-label")).toBe("Mark learned");
        expect(button().getAttribute("aria-pressed")).toBe("false");

        fireEvent.click(button());
        expect(services.mastery.load("btn-click")?.learned).toBe(true);
        // Learned: the same control stays, now pressed and labelled "Learned".
        expect(button().getAttribute("aria-pressed")).toBe("true");
        expect(button().getAttribute("aria-label")).toBe("Learned");

        // Clicking again un-marks it, so a mistaken mark isn't a dead end.
        fireEvent.click(button());
        expect(services.mastery.load("btn-click")?.learned).toBe(false);
        expect(button().getAttribute("aria-pressed")).toBe("false");
    });

    it("shows an already-learned piece as pressed and ready to toggle off", () => {
        const kv = memoryStore();
        const mastery = createMasteryStore(kv);
        mastery.save("btn-learned", markLearned(null, Date.now()));
        renderWithServices(<MarkLearnedButton id="btn-learned" />, { store: kv, mastery });
        const button = screen.getByRole("button", { name: "Learned" });
        expect(button.getAttribute("aria-pressed")).toBe("true");
    });
});

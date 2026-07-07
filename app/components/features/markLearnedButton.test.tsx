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

        // Not learned: a quiet outline check — a stroked path, no filled disc.
        expect(button().querySelector("circle")).toBeNull();

        fireEvent.click(button());
        expect(services.mastery.load("btn-click")?.learned).toBe(true);
        // Learned: the same control stays, now pressed and labelled "Learned".
        expect(button().getAttribute("aria-pressed")).toBe("true");
        expect(button().getAttribute("aria-label")).toBe("Learned");
        // ...and shouting it with a filled badge — the disc is the loud "done" cue.
        expect(button().querySelector("circle")).not.toBeNull();

        // Clicking again un-marks it, so a mistaken mark isn't a dead end.
        fireEvent.click(button());
        expect(services.mastery.load("btn-click")?.learned).toBe(false);
        expect(button().getAttribute("aria-pressed")).toBe("false");
        expect(button().querySelector("circle")).toBeNull();
    });

    it("shows an already-learned piece as pressed and ready to toggle off", () => {
        const kv = memoryStore();
        const mastery = createMasteryStore(kv);
        mastery.save("btn-learned", markLearned(null, Date.now()));
        renderWithServices(<MarkLearnedButton id="btn-learned" />, { store: kv, mastery });
        const button = screen.getByRole("button", { name: "Learned" });
        expect(button.getAttribute("aria-pressed")).toBe("true");
    });

    it("carries its state colour alone, with no variant text colour to override it", () => {
        // The colour is the only learned/not signal, so it must actually apply: the button
        // uses the text-colour-less `plain` variant, so no variant text-* utility competes
        // with the green (both would be same-property utilities, and without tailwind-merge
        // the winner is stylesheet order, not class order — the green could silently lose).
        const kv = memoryStore();
        const mastery = createMasteryStore(kv);
        mastery.save("btn-colour", markLearned(null, Date.now()));
        renderWithServices(<MarkLearnedButton id="btn-colour" />, { store: kv, mastery });
        const classes = screen.getByRole("button", { name: "Learned" }).className;
        expect(classes).toContain("text-green-600");
        expect(classes).toContain("dark:text-green-400");
        // No competing text colour from the variant (the ghost indigo that used to win).
        expect(classes).not.toContain("text-indigo-700");
        expect(classes).not.toContain("dark:text-indigo-300");
    });
});

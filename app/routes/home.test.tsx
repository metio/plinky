// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { LEARN_PICK_HREF } from "../../core/learnPick";
import { METHODS_ANCHOR } from "../../core/practiceMethods";
import { localizedHref } from "../components/ui/href";
import { MidiProvider } from "../contexts/midi";
import { m } from "../paraglide/messages.js";
import Home from "./home";

afterEach(() => {
    cleanup();
    localStorage.clear();
});

function renderHome() {
    // The hero keyboard listens for MIDI, so it needs the provider the app supplies.
    return render(
        <MemoryRouter>
            <MidiProvider>
                <Home />
            </MidiProvider>
        </MemoryRouter>,
    );
}

describe("Home", () => {
    it("leads with the day rather than with a pitch", async () => {
        renderHome();
        // The day's own session owns the heading, since only the reader's clock knows
        // which day it is. It arrives naming the weekday and the part of it.
        const heading = await screen.findByRole("heading", { level: 1 });
        expect(heading.textContent).toBeTruthy();
        expect(screen.queryByRole("heading", { level: 1, name: m.home_heading() })).toBeNull();
    });

    it("keeps the introduction in the document for a first visit", () => {
        renderHome();
        // Prerendered, so a crawler and a stranger both read it. The pre-paint
        // bootstrap hides it on a device that has played, which is a class on
        // <html> rather than a different tree — so it is always rendered here.
        expect(screen.getByText(m.home_heading())).toBeTruthy();
        expect(screen.getByText(m.home_eyebrow())).toBeTruthy();
    });

    it("gives the ways to practise a section of their own, straight after the warm-up", () => {
        renderHome();
        // A peer of the day's other moments, headed the same way, with the keyboard, its
        // leaf and a line saying what a press does. It is drawn before the day's session has
        // arrived, so it is in the static document.
        const heading = screen.getByRole("heading", { level: 2, name: m.methods_title() });
        const section = heading.closest("section") as HTMLElement;
        expect(section.id).toBe(METHODS_ANCHOR);
        expect(within(section).getByText(m.methods_keys_hint())).toBeTruthy();
        expect(within(section).getByRole("group", { name: m.keyboard_label() })).toBeTruthy();
        expect(within(section).getByRole("region")).toBeTruthy();
        const warmUp = screen
            .getByRole("heading", { level: 2, name: m.today_moment_warmup() })
            .closest("section");
        expect(warmUp?.nextElementSibling).toBe(section);
        // The keyboard is the one menu of methods; there is no list of them beside it.
        expect(screen.getAllByRole("heading", { name: m.methods_title() })).toHaveLength(1);
        expect(screen.getAllByRole("region")).toHaveLength(1);
    });

    it("is where the day's pick for the ways to practise lands", () => {
        renderHome();
        // The href the pick's row builds, followed to the element it names on the page: the
        // section holding the keyboard and its leaf.
        const href = localizedHref(LEARN_PICK_HREF.methods);
        const [path, anchor] = href.split("#");
        expect(path).toBe(localizedHref("/"));
        const target = document.getElementById(anchor ?? "") as HTMLElement;
        expect(within(target).getByRole("heading", { name: m.methods_title() })).toBeTruthy();
        expect(within(target).getByRole("group", { name: m.keyboard_label() })).toBeTruthy();
        expect(within(target).getByRole("region")).toBeTruthy();
    });

    it("sends browsing to the two hubs instead of listing destinations itself", () => {
        renderHome();
        // The destination cards moved onto Music and Learn: a page that suggests
        // four times over has decided nothing for the reader.
        expect(screen.queryByText(`${m.home_assignments()} →`)).toBeNull();
        expect(screen.queryByText(`${m.play_compose()} →`)).toBeNull();
        expect(screen.queryByText(`${m.ear_title()} →`)).toBeNull();
    });
});

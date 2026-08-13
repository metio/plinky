// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, fireEvent, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AudioEngine } from "../ports/audioEngine";
import { m } from "../paraglide/messages.js";
import { renderWithServices } from "../testing/renderWithServices";
import Learn from "./learn";

afterEach(cleanup);

const show = (overrides = {}) =>
    renderWithServices(
        <MemoryRouter>
            <Learn />
        </MemoryRouter>,
        overrides,
    );

const hrefFor = (label: string) =>
    screen.getByText(`${label} →`).closest("a")?.getAttribute("href");

describe("the Learn page", () => {
    it("gathers the whole schoolroom, each entry saying what it is", () => {
        show();
        for (const label of [
            m.basics_title(),
            m.theory_title(),
            m.glossary_title(),
            m.ear_title(),
            m.methods_title(),
            m.tools_title(),
            m.placement_title(),
        ]) {
            expect(screen.getByText(`${label} →`)).toBeTruthy();
        }
        // The entry carries the page's own opening line, so the two always agree.
        expect(screen.getByText(m.theory_intro())).toBeTruthy();
    });

    it("gives the pages that had no door one that outlives a checklist", () => {
        show();
        // Each of these was reachable only through a paragraph on the Help page, the
        // foot of the You page, or a dismissible checklist.
        expect(hrefFor(m.glossary_title())).toBe("/en/glossary/");
        expect(hrefFor(m.theory_title())).toBe("/en/theory/");
        expect(hrefFor(m.tools_title())).toBe("/en/tools/");
        expect(hrefFor(m.basics_title())).toBe("/en/basics/");
        expect(hrefFor(m.methods_title())).toBe("/en/methods/");
        expect(hrefFor(m.placement_title())).toBe("/en/placement/");
    });

    it("gathers setting work for somebody else under its own heading", () => {
        show();
        expect(screen.getByRole("heading", { name: m.learn_teaching_heading() })).toBeTruthy();
        // An assignment is an ordered path someone laid — a teacher's, or your own —
        // so it is a course of study rather than a shelf to browse.
        expect(hrefFor(m.home_assignments())).toBe("/en/assignments/");
        // And the other half of the loop, which reads the codes a student sends back.
        // The two used never to link to each other.
        expect(hrefFor(m.collect_title())).toBe("/en/collect/");
    });

    it("climbs a scale under a mouse, and stays quiet under a finger", () => {
        const strike = vi.fn();
        const audio: AudioEngine = {
            now: () => 0,
            running: () => true,
            resume: () => {},
            unlock: () => {},
            strike,
            press: () => {},
            release: () => {},
            setPedal: () => {},
            allNotesOff: () => {},
            click: () => {},
        };
        show({ audio });

        const first = screen.getByText(`${m.basics_title()} →`).closest("a") as HTMLElement;
        fireEvent.pointerEnter(first, { pointerType: "mouse" });
        expect(strike).toHaveBeenCalledTimes(1);
        expect(strike.mock.calls[0]?.[0]?.note).toBe(60);

        // A tap fires pointerenter too; it stays silent so touch browsing doesn't
        // read as phantom key presses.
        fireEvent.pointerEnter(first, { pointerType: "touch" });
        expect(strike).toHaveBeenCalledTimes(1);
    });
});

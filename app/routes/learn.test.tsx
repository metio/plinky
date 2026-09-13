// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, fireEvent, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AudioEngine } from "../ports/audioEngine";
import { LESSONS } from "../../core/theoryCourse";
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

const hrefFor = (label: string) => screen.getByText(label).closest("a")?.getAttribute("href");

describe("the Learn page", () => {
    it("gathers the whole schoolroom, each entry saying what it is", () => {
        show();
        for (const label of [
            m.basics_title(),
            m.theory_title(),
            m.glossary_title(),
            m.ear_title(),
            m.tools_title(),
            m.placement_title(),
        ]) {
            expect(screen.getByText(label)).toBeTruthy();
        }
        // The entry carries the page's own opening line, so the two always agree.
        expect(screen.getByText(m.theory_intro({ count: LESSONS.length }))).toBeTruthy();
    });

    it("gives the pages that had no door one that outlives a checklist", () => {
        show();
        // Each of these was reachable only through a paragraph on the Help page, the
        // foot of the You page, or a dismissible checklist.
        expect(hrefFor(m.glossary_title())).toBe("/en/glossary/");
        expect(hrefFor(m.theory_title())).toBe("/en/theory/");
        expect(hrefFor(m.tools_title())).toBe("/en/tools/");
        expect(hrefFor(m.basics_title())).toBe("/en/basics/");
        expect(hrefFor(m.placement_title())).toBe("/en/placement/");
    });

    it("stays quiet under a passing mouse and a finger alike", () => {
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
            silenceStrikes: () => {},
            click: () => () => {},
            setRoom: () => {},
            commitVoice: () => {},
            uncommitVoice: () => {},
        };
        show({ audio });

        // Only a key that is pressed makes a note in Plinky; a list is read, not played.
        for (const link of screen.getAllByRole("link")) {
            fireEvent.pointerEnter(link, { pointerType: "mouse" });
            fireEvent.pointerEnter(link, { pointerType: "touch" });
        }
        expect(strike).not.toHaveBeenCalled();
    });
});

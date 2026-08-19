// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { chordPitches } from "../../../core/theory";
import { ChordReadout } from "./chordReadout";

afterEach(cleanup);

const shown = () => screen.getByRole("status").textContent;

describe("ChordReadout", () => {
    it("says nothing when no keys are down", () => {
        render(<ChordReadout notes={[]} />);
        expect(shown()).toBe("");
    });

    it("keeps its line whether or not anything sounds", () => {
        // Naming a chord must not push the page down under the reader's hands mid-play.
        render(<ChordReadout notes={[]} />);
        expect(screen.getByRole("status").className).toContain("h-6");
    });

    it("names one key", () => {
        render(<ChordReadout notes={[60]} />);
        expect(shown()).toBe("C");
    });

    it("names a chord", () => {
        render(<ChordReadout notes={chordPitches(60, "major")} />);
        expect(shown()).toContain("C");
    });

    it("writes an inversion as a slash chord, which needs no translating", () => {
        // The bass after a slash is how a chart writes it and how a player says it.
        render(<ChordReadout notes={[64, 67, 72]} />);
        expect(shown()).toMatch(/^C .*\/ E$/);
    });

    it("names two keys as an interval, not as a chord missing a note", () => {
        render(<ChordReadout notes={[60, 67]} />);
        expect(shown()).toContain("C");
        expect(shown()).toContain("·");
    });

    it("announces itself politely, so a screen reader is told without being interrupted", () => {
        render(<ChordReadout notes={[60]} />);
        expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
    });
});

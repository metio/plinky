// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { namingFor } from "../../../core/noteNaming";
import { chordPitches } from "../../../core/theory";
import { m } from "../../paraglide/messages.js";
import { baseLocale, overwriteGetLocale } from "../../paraglide/runtime.js";
import { ChordReadout } from "./chordReadout";

afterEach(() => {
    cleanup();
    overwriteGetLocale(() => baseLocale);
});

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

    it("says nothing for one key, which the key itself already says", () => {
        // The keys can print their own names, so a single letter here repeated the one
        // under the finger. What this is for is the sound you cannot look up — a shape
        // your hand knows and your vocabulary does not — and that starts at two notes.
        render(<ChordReadout notes={[60]} />);
        expect(shown()).toBe("");
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

    it("names a German chord the way the German keys do, B natural as H", () => {
        overwriteGetLocale(() => "de");
        render(<ChordReadout notes={chordPitches(71, "major")} naming={namingFor("all", "de")} />);
        expect(shown()).toBe(m.root_named({ root: "H", name: m.theory_chord_major() }));
    });

    it("names a French chord in do re mi, the sharp as a word, opening in capitals", () => {
        overwriteGetLocale(() => "fr");
        render(<ChordReadout notes={chordPitches(66, "minor")} />);
        const root = m.note_sharp_word({ note: m.solfege_fa() });
        const line = m.root_named({ root, name: m.theory_chord_minor() });
        expect(shown()).toBe(`${line.charAt(0).toUpperCase()}${line.slice(1)}`);
        expect(shown()).not.toContain("F♯");
    });

    it("follows the player's letters on a French page", () => {
        overwriteGetLocale(() => "fr");
        render(<ChordReadout notes={chordPitches(62, "major")} naming={namingFor("all", "fr")} />);
        expect(shown()).toBe(m.root_named({ root: "D", name: m.theory_chord_major() }));
    });

    it("announces itself politely, so a screen reader is told without being interrupted", () => {
        render(<ChordReadout notes={[60]} />);
        expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
    });
});

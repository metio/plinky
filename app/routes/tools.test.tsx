// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CIRCLE } from "../../core/circleOfFifths";
import { NOTE_TEXT, noteNameOf } from "../../core/theory";
import { m } from "../paraglide/messages.js";
import { baseLocale, overwriteGetLocale } from "../paraglide/runtime.js";
import { renderWithServices } from "../testing/renderWithServices";
import ToolsRoute from "./tools";

afterEach(() => {
    cleanup();
    overwriteGetLocale(() => baseLocale);
});

// German calls B natural H and reserves B for B flat, so a letter table read in German
// names the wrong note: D major's relative minor would read as B flat minor.
describe("ToolsRoute in German", () => {
    it("names D major's relative minor h-Moll, with its sharps as words", () => {
        overwriteGetLocale(() => "de");
        renderWithServices(<ToolsRoute />);
        fireEvent.click(screen.getAllByRole("tab", { name: "D" })[0] as HTMLElement);
        expect(screen.getByText("Fis · Cis")).toBeTruthy();
        expect(screen.getByText("h-Moll")).toBeTruthy();
        expect(screen.queryByText("B-Moll")).toBeNull();
    });

    it("calls the key of B natural H and the key of B flat B", () => {
        overwriteGetLocale(() => "de");
        renderWithServices(<ToolsRoute />);
        const circle = screen.getByRole("tablist", { name: m.tools_circle_title() });
        const names = Array.from(circle.querySelectorAll('[role="tab"]')).map(
            (tab) => tab.textContent,
        );
        expect(names).toContain("H");
        expect(names).toContain("B");
        expect(names).not.toContain("B♭");
        // Picking H shows B major's five sharps and its relative minor, gis-Moll.
        fireEvent.click(screen.getAllByRole("tab", { name: "H" })[0] as HTMLElement);
        expect(screen.getByText("Fis · Cis · Gis · Dis · Ais")).toBeTruthy();
        expect(screen.getByText("gis-Moll")).toBeTruthy();
    });

    it("names the keys under the hand in German too", () => {
        overwriteGetLocale(() => "de");
        renderWithServices(<ToolsRoute />);
        // The root choosers are on sharps, the eleventh semitone above C is H.
        const [root] = screen.getAllByRole("tablist", { name: m.tools_root() });
        const names = Array.from(root?.querySelectorAll('[role="tab"]') ?? []).map(
            (tab) => tab.textContent,
        );
        expect(names).toEqual([
            "C",
            "Cis",
            "D",
            "Dis",
            "E",
            "F",
            "Fis",
            "G",
            "Gis",
            "A",
            "Ais",
            "H",
        ]);
    });
});

describe("ToolsRoute", () => {
    it("offers every key on the circle", () => {
        renderWithServices(<ToolsRoute />);
        for (const key of CIRCLE) {
            // Each key spells its own tonic: the flat side reads D♭, not C♯.
            const name = NOTE_TEXT[noteNameOf(key.tonic, key.spelling)];
            // The keys are one control now, not twelve buttons: picking one of twelve is
            // the same gesture as picking one of thirteen scales below them.
            expect(screen.getAllByRole("tab", { name }).length).toBeGreaterThan(0);
        }
    });

    it("starts on C, which writes no accidentals at all", () => {
        renderWithServices(<ToolsRoute />);
        expect(screen.getByText(m.tools_circle_none())).toBeTruthy();
        expect(screen.getByText(m.tools_circle_minor({ note: "A" }))).toBeTruthy();
    });

    it("names the signature and relative minor of the key picked", () => {
        renderWithServices(<ToolsRoute />);
        // D major: two sharps, F♯ and C♯, relative minor B.
        fireEvent.click(screen.getAllByRole("tab", { name: "D" })[0] as HTMLElement);
        expect(screen.getByText("F♯ · C♯")).toBeTruthy();
        expect(screen.getByText(m.tools_circle_minor({ note: "B" }))).toBeTruthy();
    });

    it("names the root choosers by letter in English", () => {
        renderWithServices(<ToolsRoute />);
        const [root] = screen.getAllByRole("tablist", { name: m.tools_root() });
        const names = Array.from(root?.querySelectorAll('[role="tab"]') ?? []).map(
            (tab) => tab.textContent,
        );
        expect(names).toEqual(["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"]);
    });

    it("offers a scale and a chord chooser, each with its own root", () => {
        renderWithServices(<ToolsRoute />);
        expect(screen.getByRole("tablist", { name: m.tools_scale() })).toBeTruthy();
        expect(screen.getByRole("tablist", { name: m.tools_chord() })).toBeTruthy();
        // One root chooser per panel that starts from a note — scale, chord, interval.
        // They are independent, so picking a scale on D leaves the others where they were.
        expect(screen.getAllByRole("tablist", { name: m.tools_root() })).toHaveLength(3);
    });

    it("hands the tapped tempo to the metronome", () => {
        renderWithServices(<ToolsRoute />);
        // Two errands, one number: tapping along to something and then playing at that
        // speed is the same job.
        const slider = screen.getByRole("slider", { name: m.tools_metro_tempo() });
        const before = (slider as HTMLInputElement).value;
        const tap = screen.getByRole("button", { name: m.tools_tap_action() });
        fireEvent.click(tap);
        fireEvent.click(tap);
        expect((slider as HTMLInputElement).value).not.toBe(before);
        expect(screen.getByRole("button", { name: m.tools_metro_start() })).toBeTruthy();
    });

    it("names the note an interval lands on", () => {
        renderWithServices(<ToolsRoute />);
        // A fifth up from C is G, and the panel says so rather than only lighting it.
        expect(screen.getByText(m.tools_interval_lands())).toBeTruthy();
        expect(screen.getByRole("tablist", { name: m.tools_interval_label() })).toBeTruthy();
    });

    it("reads a tempo back once there are two taps", () => {
        renderWithServices(<ToolsRoute />);
        const button = screen.getByRole("button", { name: m.tools_tap_action() });
        expect(screen.getByText("—")).toBeTruthy();
        fireEvent.click(button);
        fireEvent.click(button);
        // The gap between two synthetic clicks is real wall-clock time, so the figure
        // itself is not predictable — that it stopped being a dash is what matters.
        expect(screen.queryByText("—")).toBeNull();
        expect(screen.getByRole("button", { name: m.tools_tap_reset() })).toBeTruthy();
    });

    it("starts the tap reading over on request", () => {
        renderWithServices(<ToolsRoute />);
        const button = screen.getByRole("button", { name: m.tools_tap_action() });
        fireEvent.click(button);
        fireEvent.click(button);
        fireEvent.click(screen.getByRole("button", { name: m.tools_tap_reset() }));
        expect(screen.getByText("—")).toBeTruthy();
    });
});

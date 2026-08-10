// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CIRCLE } from "../../core/circleOfFifths";
import { NOTE_TEXT, noteNameOf } from "../../core/theory";
import { m } from "../paraglide/messages.js";
import { renderWithServices } from "../testing/renderWithServices";
import ToolsRoute from "./tools";

afterEach(cleanup);

describe("ToolsRoute", () => {
    it("offers every key on the circle", () => {
        renderWithServices(<ToolsRoute />);
        for (const key of CIRCLE) {
            // Each key spells its own tonic: the flat side reads D♭, not C♯.
            const name = NOTE_TEXT[noteNameOf(key.tonic, key.spelling)];
            expect(screen.getAllByRole("button", { name }).length).toBeGreaterThan(0);
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
        fireEvent.click(screen.getAllByRole("button", { name: "D" })[0] as HTMLElement);
        expect(screen.getByText("F♯ · C♯")).toBeTruthy();
        expect(screen.getByText(m.tools_circle_minor({ note: "B" }))).toBeTruthy();
    });

    it("offers a scale and a chord chooser, each with its own root", () => {
        renderWithServices(<ToolsRoute />);
        expect(screen.getByRole("tablist", { name: m.tools_scale() })).toBeTruthy();
        expect(screen.getByRole("tablist", { name: m.tools_chord() })).toBeTruthy();
        // One root chooser per explorer — they are independent, so picking a scale on
        // D leaves the chord explorer where it was.
        expect(screen.getAllByRole("tablist", { name: m.tools_root() })).toHaveLength(2);
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

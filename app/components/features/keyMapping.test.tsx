// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { renderWithServices } from "../../testing/renderWithServices";

import { KeyMapping } from "./keyMapping";

afterEach(cleanup);

describe("KeyMapping", () => {
    it("shows the default keys per note", () => {
        renderWithServices(<KeyMapping />);
        // The left hand's C is bound to 'z' by default.
        expect(screen.getByRole("button", { name: /Rebind C, Left hand/i }).textContent).toContain(
            "Z",
        );
    });

    it("rebinds a note to the next key pressed and persists it", () => {
        const { services } = renderWithServices(<KeyMapping />);
        const cap = screen.getByRole("button", { name: /Rebind C, Left hand/i });

        fireEvent.click(cap);
        expect(cap.getAttribute("aria-pressed")).toBe("true");

        fireEvent.keyDown(window, { key: "a" });

        expect(cap.getAttribute("aria-pressed")).toBe("false");
        expect(cap.textContent).toContain("A");
        expect(services.prefs.load().keyMap.left.a).toBe(0);
    });

    it("cancels an armed rebind on Escape without changing the binding", () => {
        const { services } = renderWithServices(<KeyMapping />);
        const cap = screen.getByRole("button", { name: /Rebind C, Left hand/i });

        fireEvent.click(cap);
        fireEvent.keyDown(window, { key: "Escape" });

        expect(cap.getAttribute("aria-pressed")).toBe("false");
        expect(services.prefs.load().keyMap.left.z).toBe(0);
    });

    it("marks the keys discovery step on engaging, even when the defaults are kept", () => {
        const { services } = renderWithServices(<KeyMapping />);
        expect(services.onboarding.marked().has("keysCustomized")).toBe(false);
        // Arm a cap then cancel: the layout stays at the default, but engaging with the
        // editor still ticks off the discovery step — so liking the defaults isn't a dead end.
        fireEvent.click(screen.getByRole("button", { name: /Rebind C, Left hand/i }));
        fireEvent.keyDown(window, { key: "Escape" });
        expect(services.onboarding.marked().has("keysCustomized")).toBe(true);
        expect(services.prefs.load().keyMap.left.z).toBe(0);
    });

    it("marks the keys discovery step when the standard layout is kept via reset", () => {
        const { services } = renderWithServices(<KeyMapping />);
        fireEvent.click(screen.getByRole("button", { name: "Reset to default" }));
        expect(services.onboarding.marked().has("keysCustomized")).toBe(true);
    });

    it("restores the default layout on reset", () => {
        const { services } = renderWithServices(<KeyMapping />);
        fireEvent.click(screen.getByRole("button", { name: /Rebind C, Left hand/i }));
        fireEvent.keyDown(window, { key: "a" });
        expect(services.prefs.load().keyMap.left.a).toBe(0);

        fireEvent.click(screen.getByRole("button", { name: "Reset to default" }));
        expect(services.prefs.load().keyMap.left.z).toBe(0);
        expect("a" in services.prefs.load().keyMap.left).toBe(false);
    });
});

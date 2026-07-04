// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { browserStore } from "../adapters/browserStore";
import { createPrefsStore } from "../stores/prefsStore";

// Reads and writes go through a store over the same backing localStorage the
// component under test uses, so seeding and asserting see one source of truth.
const prefsStore = createPrefsStore(browserStore);
import { KeyMapping } from "./keyMapping";

afterEach(() => {
    cleanup();
    localStorage.clear();
});

describe("KeyMapping", () => {
    it("shows the default keys per note", () => {
        render(<KeyMapping />);
        // The left hand's C is bound to 'a' by default.
        expect(screen.getByRole("button", { name: /Rebind C, Left hand/i }).textContent).toContain(
            "A",
        );
    });

    it("rebinds a note to the next key pressed and persists it", () => {
        render(<KeyMapping />);
        const cap = screen.getByRole("button", { name: /Rebind C, Left hand/i });

        fireEvent.click(cap);
        expect(cap.getAttribute("aria-pressed")).toBe("true");

        fireEvent.keyDown(window, { key: "z" });

        expect(cap.getAttribute("aria-pressed")).toBe("false");
        expect(cap.textContent).toContain("Z");
        expect(prefsStore.load().keyMap.left.z).toBe(0);
    });

    it("cancels an armed rebind on Escape without changing the binding", () => {
        render(<KeyMapping />);
        const cap = screen.getByRole("button", { name: /Rebind C, Left hand/i });

        fireEvent.click(cap);
        fireEvent.keyDown(window, { key: "Escape" });

        expect(cap.getAttribute("aria-pressed")).toBe("false");
        expect(prefsStore.load().keyMap.left.a).toBe(0);
    });

    it("restores the default layout on reset", () => {
        render(<KeyMapping />);
        fireEvent.click(screen.getByRole("button", { name: /Rebind C, Left hand/i }));
        fireEvent.keyDown(window, { key: "z" });
        expect(prefsStore.load().keyMap.left.z).toBe(0);

        fireEvent.click(screen.getByRole("button", { name: "Reset to default" }));
        expect(prefsStore.load().keyMap.left.a).toBe(0);
        expect("z" in prefsStore.load().keyMap.left).toBe(false);
    });
});

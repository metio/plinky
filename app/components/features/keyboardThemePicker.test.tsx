// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { m } from "../../paraglide/messages.js";
import { renderWithServices } from "../../testing/renderWithServices";
import { KeyboardThemePicker } from "./keyboardThemePicker";

afterEach(cleanup);

describe("KeyboardThemePicker", () => {
    it("offers the always-free classic skin, selected by default", async () => {
        renderWithServices(<KeyboardThemePicker />);
        const classic = await screen.findByRole("button", { name: new RegExp(m.theme_classic()) });
        expect(classic.getAttribute("aria-pressed")).toBe("true");
        expect((classic as HTMLButtonElement).disabled).toBe(false);
    });

    it("locks a skin behind its grade for a fresh player", async () => {
        renderWithServices(<KeyboardThemePicker />);
        // A new device has grade 0, so Sunset (grade 2) is locked with its unlock hint.
        await waitFor(() => {
            const sunset = screen.getByRole("button", { name: new RegExp(m.theme_sunset()) });
            expect((sunset as HTMLButtonElement).disabled).toBe(true);
        });
        expect(screen.getByText(m.grade_label({ level: 2 }), { exact: false })).toBeTruthy();
    });
});

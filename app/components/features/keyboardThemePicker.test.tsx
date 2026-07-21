// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { m } from "../../paraglide/messages.js";
import { renderWithServices } from "../../testing/renderWithServices";
import { KeyboardThemePicker } from "./keyboardThemePicker";

afterEach(cleanup);

describe("KeyboardThemePicker", () => {
    it("offers the classic skin, selected by default", async () => {
        renderWithServices(<KeyboardThemePicker />);
        const classic = await screen.findByRole("button", { name: new RegExp(m.theme_classic()) });
        expect(classic.getAttribute("aria-pressed")).toBe("true");
        expect((classic as HTMLButtonElement).disabled).toBe(false);
    });

    it("leaves every skin free to pick — a fresh player can wear any of them", async () => {
        renderWithServices(<KeyboardThemePicker />);
        // A brand-new device is grade 0, yet no skin is gated: Plinky never locks looks.
        for (const name of [m.theme_sunset(), m.theme_forest(), m.theme_berry()]) {
            const skin = await screen.findByRole("button", { name: new RegExp(name) });
            expect((skin as HTMLButtonElement).disabled).toBe(false);
        }
    });
});

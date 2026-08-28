// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GLOSSY, JOYFUL } from "../../../core/keyboardFinish";
import { m } from "../../paraglide/messages.js";
import { renderWithServices } from "../../testing/renderWithServices";
import { KeyboardFinishPicker } from "./keyboardThemePicker";

// Rendered trees are not torn down between tests here, so a second render would find
// two of every button.
afterEach(cleanup);

const pick = (name: string) => screen.getByRole("button", { name });

describe("KeyboardFinishPicker", () => {
    it("opens on joyful, which is what a new player gets", () => {
        renderWithServices(<KeyboardFinishPicker />);
        expect(pick(m.finish_joyful()).getAttribute("aria-pressed")).toBe("true");
        expect(pick(m.finish_glossy()).getAttribute("aria-pressed")).toBe("false");
    });

    it("saves the choice, so every keyboard in the app follows it", () => {
        const { services } = renderWithServices(<KeyboardFinishPicker />);
        fireEvent.click(pick(m.finish_glossy()));
        expect(services.prefs.load().keyboardFinish).toBe(GLOSSY.id);
        expect(pick(m.finish_glossy()).getAttribute("aria-pressed")).toBe("true");
    });

    it("leaves the colour skin alone — the two are separate questions", () => {
        const { services } = renderWithServices(<KeyboardFinishPicker />);
        services.prefs.save({ ...services.prefs.load(), keyboardTheme: "berry" });
        fireEvent.click(pick(m.finish_glossy()));
        expect(services.prefs.load().keyboardTheme).toBe("berry");
        expect(services.prefs.load().keyboardFinish).toBe(GLOSSY.id);
    });

    it("can be switched back", () => {
        const { services } = renderWithServices(<KeyboardFinishPicker />);
        fireEvent.click(pick(m.finish_glossy()));
        fireEvent.click(pick(m.finish_joyful()));
        expect(services.prefs.load().keyboardFinish).toBe(JOYFUL.id);
    });

    it("offers the finishes as a labelled group, since it is one question", () => {
        renderWithServices(<KeyboardFinishPicker />);
        const group = screen.getByRole("group", { name: m.settings_keyboard_finish() });
        expect(group).toBeTruthy();
    });
});

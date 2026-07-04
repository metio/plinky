// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Switch } from "./switch";

afterEach(cleanup);

describe("Switch", () => {
    it("is a role=switch reflecting checked state, 44px tall", () => {
        render(<Switch checked onChange={() => {}} label="Metronome" />);
        const sw = screen.getByRole("switch", { name: "Metronome" });
        expect(sw.getAttribute("aria-checked")).toBe("true");
        expect(sw.className).toContain("min-h-11");
    });

    it("toggles to the opposite value on click", () => {
        const onChange = vi.fn();
        render(<Switch checked={false} onChange={onChange} label="Metronome" />);
        fireEvent.click(screen.getByRole("switch", { name: "Metronome" }));
        expect(onChange).toHaveBeenCalledWith(true);
    });

    it("does not fire when disabled", () => {
        const onChange = vi.fn();
        render(<Switch checked={false} onChange={onChange} label="Metronome" disabled />);
        fireEvent.click(screen.getByRole("switch", { name: "Metronome" }));
        expect(onChange).not.toHaveBeenCalled();
    });
});

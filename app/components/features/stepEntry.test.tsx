// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { m } from "../../paraglide/messages.js";
import { chosen, choose, switchOn, toggle } from "../../testing/controls";
import { StepEntry } from "./stepEntry";

afterEach(cleanup);

const props = {
    on: true,
    onOn: vi.fn(),
    value: "quarter" as const,
    onValue: vi.fn(),
    dotted: false,
    onDotted: vi.fn(),
    onRest: vi.fn(),
    onBack: vi.fn(),
    canGoBack: true,
};

const show = (overrides: Partial<typeof props> = {}) =>
    render(<StepEntry {...props} {...overrides} />);

describe("StepEntry", () => {
    it("offers nothing but the switch until it is turned on", () => {
        // Compose is a place to improvise first; the machinery for writing a piece down
        // should not be in the way of somebody who wanted to play.
        show({ on: false });
        expect(switchOn(m.step_entry)).toBe(false);
        expect(screen.queryByRole("tablist", { name: m.step_value() })).toBeNull();
        expect(screen.queryByRole("button", { name: m.step_rest() })).toBeNull();
    });

    it("shows the length, the dot and the two moves once it is on", () => {
        show();
        expect(chosen(m.step_value)).toBe(m.step_value_quarter());
        expect(screen.getByRole("button", { name: m.step_rest() })).toBeTruthy();
        expect(screen.getByRole("button", { name: m.step_back() })).toBeTruthy();
    });

    it("passes on a change of length and of the dot", () => {
        const onValue = vi.fn();
        const onDotted = vi.fn();
        show({ onValue, onDotted });
        choose(m.step_value, m.step_value_eighth);
        expect(onValue).toHaveBeenCalledWith("eighth");
        toggle(m.step_dotted);
        expect(onDotted).toHaveBeenCalledWith(true);
    });

    it("cannot take a step back from an empty take", () => {
        show({ canGoBack: false });
        const back = screen.getByRole("button", { name: m.step_back() }) as HTMLButtonElement;
        expect(back.disabled).toBe(true);
    });
});

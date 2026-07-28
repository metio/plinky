// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_DRILL, type DrillOptions } from "../../../core/drill";
import { DRILL_FIELDS } from "../../../core/drillSpec";
import { m } from "../../paraglide/messages.js";
import { DrillSetup, noteName } from "./drillSetup";

afterEach(cleanup);

function mount(over: Partial<DrillOptions> = {}) {
    const onChange = vi.fn();
    const value = { ...DEFAULT_DRILL, ...over };
    render(<DrillSetup value={value} onChange={onChange} />);
    return { onChange, value };
}

describe("noteName", () => {
    it("names a MIDI note the way a keyboard does", () => {
        expect(noteName(60)).toBe("C4");
        expect(noteName(21)).toBe("A0");
        expect(noteName(108)).toBe("C8");
        expect(noteName(61)).toBe("C♯4");
    });
});

describe("DrillSetup", () => {
    it("offers a control for every option the generator takes", () => {
        mount();

        // The panel renders from DRILL_FIELDS, so a knob added to the spec cannot
        // quietly fail to reach the reader.
        expect(DRILL_FIELDS).toHaveLength(9);
        expect(screen.getByText(m.drill_bars())).toBeTruthy();
        expect(screen.getByText(m.drill_key())).toBeTruthy();
        expect(screen.getByText(m.drill_range())).toBeTruthy();
        expect(screen.getByText(m.drill_notes())).toBeTruthy();
        expect(screen.getByText(m.drill_leap())).toBeTruthy();
        expect(screen.getByText(m.drill_smoothness())).toBeTruthy();
        expect(screen.getByRole("switch", { name: m.drill_chromatic() })).toBeTruthy();
    });

    it("names the key rather than counting its sharps", () => {
        mount({ fifths: 2 });

        expect(screen.getByText("D")).toBeTruthy();
    });

    it("reads a leap of nothing as no limit at all", () => {
        mount({ maxLeap: 0 });

        expect(screen.getByText(m.drill_leap_free())).toBeTruthy();
    });

    it("hands back a whole drill, not a patch", () => {
        const { onChange } = mount({ bars: 8 });

        fireEvent.click(
            screen.getByRole("button", { name: m.drill_more({ field: m.drill_bars() }) }),
        );

        expect(onChange).toHaveBeenCalledWith(
            expect.objectContaining({ ...DEFAULT_DRILL, bars: 9 }),
        );
    });

    it("will not let a range be dragged inside out", () => {
        mount({ low: 72, high: 72 });

        // The ends bound each other, so the lower cannot pass the upper.
        expect(
            screen.getByRole("button", { name: m.drill_range_lower_up() }).hasAttribute("disabled"),
        ).toBe(true);
        expect(
            screen
                .getByRole("button", { name: m.drill_range_upper_down() })
                .hasAttribute("disabled"),
        ).toBe(true);
    });

    it("stops each option at the bound the generator would clamp it to anyway", () => {
        mount({ bars: 32, notesPerColumn: 1 });

        expect(
            screen
                .getByRole("button", { name: m.drill_more({ field: m.drill_bars() }) })
                .hasAttribute("disabled"),
        ).toBe(true);
        expect(
            screen
                .getByRole("button", { name: m.drill_less({ field: m.drill_notes() }) })
                .hasAttribute("disabled"),
        ).toBe(true);
    });

    it("switches to reading every note in the octave", () => {
        const { onChange } = mount();

        fireEvent.click(screen.getByRole("switch", { name: m.drill_chromatic() }));

        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ chromatic: true }));
    });
});

// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChoiceField, SwitchField } from "./fields";

afterEach(cleanup);

describe("ChoiceField", () => {
    it("shows every option as a segment and reports the chosen one", () => {
        const onChange = vi.fn();
        render(
            <ChoiceField
                label="Decay"
                value="gentle"
                onChange={onChange}
                options={[
                    { id: "gentle", label: "Gentle" },
                    { id: "competitive", label: "Competitive" },
                ]}
            />,
        );

        expect(screen.getByRole("tab", { name: "Gentle" }).getAttribute("aria-selected")).toBe(
            "true",
        );
        fireEvent.click(screen.getByRole("tab", { name: "Competitive" }));
        expect(onChange).toHaveBeenCalledWith("competitive");
    });

    it("shows the help line only when one is given", () => {
        const { rerender } = render(
            <ChoiceField label="Cap" value="8" onChange={() => {}} options={[]} />,
        );
        expect(screen.queryByText("At most 8")).toBeNull();

        rerender(
            <ChoiceField label="Cap" value="8" onChange={() => {}} options={[]} help="At most 8" />,
        );
        expect(screen.getByText("At most 8")).toBeTruthy();
    });
});

describe("SwitchField", () => {
    it("is a real switch that reports the flipped state", () => {
        const onChange = vi.fn();
        render(<SwitchField label="Play sounds" checked={false} onChange={onChange} />);

        fireEvent.click(screen.getByRole("switch", { name: "Play sounds" }));
        expect(onChange).toHaveBeenCalledWith(true);
    });

    it("shows the help line only when one is given", () => {
        const { rerender } = render(<SwitchField label="Loop" checked onChange={() => {}} />);
        expect(screen.queryByText("Repeats the section")).toBeNull();

        rerender(
            <SwitchField label="Loop" checked onChange={() => {}} help="Repeats the section" />,
        );
        expect(screen.getByText("Repeats the section")).toBeTruthy();
    });
});

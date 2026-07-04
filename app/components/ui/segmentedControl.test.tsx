// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SegmentedControl } from "./segmentedControl";

afterEach(cleanup);

const OPTIONS = [
    { id: "play", label: "Play" },
    { id: "ear", label: "Ear" },
] as const;

describe("SegmentedControl", () => {
    it("exposes an ARIA tablist with the selected segment marked", () => {
        render(
            <SegmentedControl
                options={[...OPTIONS]}
                value="play"
                onChange={() => {}}
                label="Mode"
            />,
        );
        expect(screen.getByRole("tablist", { name: "Mode" })).toBeTruthy();
        expect(screen.getByRole("tab", { name: "Play" }).getAttribute("aria-selected")).toBe(
            "true",
        );
        expect(screen.getByRole("tab", { name: "Ear" }).getAttribute("aria-selected")).toBe(
            "false",
        );
    });

    it("reports the chosen id and keeps a 44px target", () => {
        const onChange = vi.fn();
        render(
            <SegmentedControl
                options={[...OPTIONS]}
                value="play"
                onChange={onChange}
                label="Mode"
            />,
        );
        const ear = screen.getByRole("tab", { name: "Ear" });
        expect(ear.className).toContain("min-h-11");
        fireEvent.click(ear);
        expect(onChange).toHaveBeenCalledWith("ear");
    });
});

// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlayModeBar } from "./playModeBar";

afterEach(() => {
    cleanup();
    localStorage.clear();
});

describe("PlayModeBar", () => {
    it("marks the active mode and reports a switch", () => {
        const onChange = vi.fn();
        render(<PlayModeBar mode="play" onChange={onChange} />);

        expect(screen.getByRole("tab", { name: "Play" }).getAttribute("aria-selected")).toBe(
            "true",
        );
        expect(screen.getByRole("tab", { name: "Runs" }).getAttribute("aria-selected")).toBe(
            "false",
        );

        fireEvent.click(screen.getByRole("tab", { name: "Runs" }));
        expect(onChange).toHaveBeenCalledWith("runs");
    });

    it("offers exactly the two tabs — the drills live inside Practice now", () => {
        render(<PlayModeBar mode="play" onChange={vi.fn()} />);
        expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Play", "Runs"]);
    });
});

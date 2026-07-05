// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { RunNote } from "../../../core/shareCard";
import { PerformanceStrip } from "./performanceStrip";

afterEach(cleanup);

const note = (targetMs: number, playedMs: number, wrongBefore = 0): RunNote => ({
    targetMs,
    playedMs,
    wrongBefore,
});

describe("PerformanceStrip", () => {
    it("renders nothing until there are two notes to span the axis", () => {
        const { container: empty } = render(<PerformanceStrip notes={[]} />);
        expect(empty.querySelector("svg")).toBeNull();
        const { container: one } = render(<PerformanceStrip notes={[note(0, 0)]} />);
        expect(one.querySelector("svg")).toBeNull();
    });

    it("plots one dot per note once there are enough", () => {
        const notes = [note(0, 0), note(500, 520), note(1000, 990)];
        const { container } = render(<PerformanceStrip notes={notes} />);
        expect(screen.getByRole("img")).toBeTruthy();
        expect(container.querySelectorAll("circle")).toHaveLength(3);
    });

    it("rings a note played after a wrong key in red", () => {
        const clean = render(
            <PerformanceStrip notes={[note(0, 0), note(500, 510), note(1000, 1005)]} />,
        );
        expect(clean.container.querySelector("circle.stroke-red-500")).toBeNull();
        cleanup();
        const withWrong = render(
            <PerformanceStrip notes={[note(0, 0), note(500, 510), note(1000, 1005, 2)]} />,
        );
        expect(withWrong.container.querySelector("circle.stroke-red-500")).toBeTruthy();
    });
});

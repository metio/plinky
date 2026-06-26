// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Bpm } from "./bpm";

describe("Bpm", () => {
    it("renders the tempo with the uppercase unit", () => {
        const { container } = render(<Bpm tempo={85} />);
        expect(container.textContent).toBe("85 BPM");
    });

    it("uses tabular figures in the surrounding font, not a monospace unit", () => {
        // A monospace unit carries its own vertical metrics and rides high next to
        // sans-set labels; tabular figures keep the digits fixed-width without it.
        const { container } = render(<Bpm tempo={120} />);
        const span = container.firstElementChild;
        expect(span?.className).toContain("tabular-nums");
        expect(span?.className).not.toContain("font-mono");
    });

    it("merges an extra class for callers that reserve a fixed column", () => {
        const { container } = render(<Bpm tempo={90} className="w-12" />);
        expect(container.firstElementChild?.className).toContain("w-12");
    });
});

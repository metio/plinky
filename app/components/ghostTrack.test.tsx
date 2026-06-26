// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GhostTrack } from "./ghostTrack";

afterEach(cleanup);

describe("GhostTrack", () => {
    it("places both markers by how far each has reached", () => {
        const { container } = render(<GhostTrack you={2} ghost={4} total={8} />);
        expect(container.textContent).toContain("🎹");
        expect(container.textContent).toContain("👻");
        // The player's fill spans their share of the piece.
        const fill = container.querySelector(".bg-indigo-500") as HTMLElement;
        expect(fill.style.width).toBe("25%");
        // Behind the ghost when fewer notes have been reached.
        expect(container.textContent).toContain("behind");
    });

    it("labels the race for assistive tech", () => {
        render(<GhostTrack you={5} ghost={3} total={10} />);
        const label = screen.getByRole("img").getAttribute("aria-label") ?? "";
        expect(label).toMatch(/5/);
        expect(label).toMatch(/3/);
        expect(label).toMatch(/10/);
    });
});

// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Chip } from "./chip";

afterEach(cleanup);

describe("Chip", () => {
    it("marks the selected state distinctly and keeps a 44px target", () => {
        const { rerender } = render(<Chip selected>Songs</Chip>);
        const selected = screen.getByRole("button").className;
        expect(selected).toContain("min-h-11");
        expect(selected).toContain("bg-indigo-600");
        rerender(<Chip>Songs</Chip>);
        expect(screen.getByRole("button").className).not.toContain("bg-indigo-600");
    });

    it("forwards toggle semantics and clicks", () => {
        const onClick = vi.fn();
        render(
            <Chip selected aria-pressed onClick={onClick}>
                Favorites
            </Chip>,
        );
        expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("true");
        fireEvent.click(screen.getByRole("button"));
        expect(onClick).toHaveBeenCalledOnce();
    });
});

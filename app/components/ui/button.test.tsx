// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button, IconButton } from "./button";

afterEach(cleanup);

describe("Button", () => {
    it("defaults to a non-submitting button with a 44px target", () => {
        render(<Button>Practice</Button>);
        const button = screen.getByRole("button", { name: "Practice" });
        expect(button.getAttribute("type")).toBe("button");
        expect(button.className).toContain("min-h-11");
    });

    it("marks the primary variant distinctly from the secondary default", () => {
        const { rerender } = render(<Button variant="primary">Go</Button>);
        const primary = screen.getByRole("button").className;
        rerender(<Button variant="secondary">Go</Button>);
        const secondary = screen.getByRole("button").className;
        expect(primary).not.toBe(secondary);
        expect(primary).toContain("bg-indigo-600");
    });

    it("forwards clicks", () => {
        const onClick = vi.fn();
        render(<Button onClick={onClick}>Tap</Button>);
        fireEvent.click(screen.getByRole("button"));
        expect(onClick).toHaveBeenCalledOnce();
    });
});

describe("IconButton", () => {
    it("carries an accessible name and a square 44px target", () => {
        render(
            <IconButton label="Full screen">
                <svg />
            </IconButton>,
        );
        const button = screen.getByRole("button", { name: "Full screen" });
        expect(button.getAttribute("title")).toBe("Full screen");
        expect(button.className).toContain("h-11");
        expect(button.className).toContain("w-11");
    });
});

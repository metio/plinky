// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Spinner } from "./spinner";
import { Treadmill } from "./treadmill";

afterEach(cleanup);

const blocks = (container: HTMLElement) =>
    [...container.querySelectorAll("span")].filter((one) =>
        one.className.includes("animate-treadmill"),
    );

describe("the treadmill", () => {
    it("says nothing to assistive technology", () => {
        const { container } = render(<Treadmill />);
        // Decoration only: a caller that means "work is under way" says so in words beside
        // it, so a reader announcing the label does not also announce the picture.
        expect(container.querySelector("[aria-hidden='true']")).not.toBeNull();
        expect(screen.queryByRole("status")).toBeNull();
        expect(screen.queryByRole("img")).toBeNull();
    });

    it("takes the size it is given rather than one of its own", () => {
        const { container } = render(<Treadmill className="size-4" />);
        expect(container.firstElementChild?.className).toContain("size-4");
    });

    it("runs fewer lanes when it has to sit beside a line of text", () => {
        // Six lanes in sixteen pixels puts every block under two pixels across, which stops
        // being a picture. The compact form is the same gesture with room to be seen.
        const full = render(<Treadmill />);
        const wide = blocks(full.container).length;
        cleanup();
        const small = render(<Treadmill compact />);
        expect(blocks(small.container).length).toBeLessThan(wide);
        expect(blocks(small.container).length).toBeGreaterThan(1);
    });

    it("keeps the two hands' own colours", () => {
        // The same pair the highway paints, so what a player already reads as left and
        // right does not come to mean something else while they wait.
        const { container } = render(<Treadmill />);
        const classes = blocks(container).map((one) => one.className);
        expect(classes.some((one) => one.includes("bg-hand-left-soft"))).toBe(true);
        expect(classes.some((one) => one.includes("bg-hand-right-soft"))).toBe(true);
    });

    it("stands still when motion is unwelcome", () => {
        const { container } = render(<Treadmill />);
        // The blocks stop where they are, which is a legible picture rather than an absence.
        for (const block of blocks(container)) {
            expect(block.className).toContain("motion-reduce:animate-none");
        }
    });
});

describe("the spinner", () => {
    it("is named out loud, and names the work exactly once", () => {
        render(<Spinner label="Loading the piece" />);
        const status = screen.getByRole("status", { name: "Loading the piece" });
        expect(status.textContent).toBe("");
    });
});

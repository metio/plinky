// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Plink } from "./plink";
import { Spinner } from "./spinner";

afterEach(cleanup);

describe("the plink", () => {
    it("says nothing to assistive technology", () => {
        const { container } = render(<Plink />);
        // Decoration only: it carries no name and no role, so a reader announcing the
        // label beside it does not also announce the mark.
        expect(container.querySelector("[aria-hidden='true']")).not.toBeNull();
        expect(screen.queryByRole("status")).toBeNull();
        expect(screen.queryByRole("img")).toBeNull();
    });

    it("takes the size it is given rather than one of its own", () => {
        const { container } = render(<Plink className="size-4" />);
        expect(container.firstElementChild?.className).toContain("size-4");
    });

    it("draws the note, its trail and the ring as one gesture", () => {
        const { container } = render(<Plink />);
        const classes = [...container.querySelectorAll("span")].map((el) => el.className);
        expect(classes.some((c) => c.includes("animate-plink-fall"))).toBe(true);
        expect(classes.some((c) => c.includes("animate-plink-trail"))).toBe(true);
        expect(classes.some((c) => c.includes("animate-plink-ring"))).toBe(true);
    });

    it("leaves a still note resting on the key when motion is unwelcome", () => {
        const { container } = render(<Plink />);
        const note = container.querySelector(".animate-plink-fall");
        // The note stops; the trail and the ring go, since neither has a resting state
        // that means anything on its own.
        expect(note?.className).toContain("motion-reduce:animate-none");
        expect(container.querySelector(".animate-plink-trail")?.className).toContain(
            "motion-reduce:hidden",
        );
        expect(container.querySelector(".animate-plink-ring")?.className).toContain(
            "motion-reduce:hidden",
        );
    });
});

describe("the spinner", () => {
    it("is named out loud, and names the work exactly once", () => {
        render(<Spinner label="Loading the piece" />);
        const status = screen.getByRole("status", { name: "Loading the piece" });
        expect(status.textContent).toBe("");
    });
});

// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { WORDMARK } from "../../../core/wordmark";
import { Wordmark } from "./wordmark";

afterEach(cleanup);

describe("Wordmark", () => {
    it("is hidden from assistive tech when it only decorates a named link", () => {
        const { container } = render(<Wordmark />);
        expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
        expect(screen.queryByRole("img")).toBeNull();
    });

    it("is announced as the name, never as the dotless letters it is drawn with", () => {
        render(<Wordmark label={WORDMARK} />);
        const mark = screen.getByRole("img", { name: "Plinky" });
        expect(mark.getAttribute("aria-label")).not.toContain("ı");
    });

    it("draws one dot, over a dotless stem", () => {
        const { container } = render(<Wordmark />);
        expect(container.textContent).toBe("Plınky");
        expect(container.querySelectorAll(".bg-brand-dot")).toHaveLength(1);
    });

    it("carries the domain as its own tail when asked", () => {
        const { container } = render(<Wordmark domain />);
        expect(container.textContent).toBe("Plınky.fun");
    });
});

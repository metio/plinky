// SPDX-FileCopyrightText: The Klimpi Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { drawnWordmark, WORDMARK } from "../../../core/wordmark";
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
        const mark = screen.getByRole("img", { name: "Klimpi" });
        expect(mark.getAttribute("aria-label")).not.toContain("ı");
    });

    it("draws a dot over every dotless stem, and one per i in the name", () => {
        const { container } = render(<Wordmark />);
        expect(container.textContent).toBe(drawnWordmark(false));
        expect(container.textContent).toBe("Klımpı");
        const dotted = [...WORDMARK].filter((letter) => letter === "i").length;
        expect(container.querySelectorAll(".bg-brand-dot")).toHaveLength(dotted);
    });

    it("is one unbreakable run, so a tight row cannot split it at a dot", () => {
        // Each dot hangs from an inline block between two runs of letters, and a line may
        // break beside an inline block.
        const { container } = render(<Wordmark />);
        expect(container.firstElementChild?.className).toContain("whitespace-nowrap");
    });

    it("carries the domain as its own tail when asked", () => {
        const { container } = render(<Wordmark domain />);
        expect(container.textContent).toBe("Klımpı.app");
    });
});

// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { markLearned } from "../lib/mastery";
import { writeMastery } from "../lib/masteryStore";
import { MarkLearnedButton } from "./markLearnedButton";

afterEach(() => {
    cleanup();
    localStorage.clear();
});

describe("MarkLearnedButton", () => {
    it("marks the piece learned, then hides as the store re-renders it", () => {
        render(<MarkLearnedButton id="btn-click" />);
        fireEvent.click(screen.getByRole("button", { name: /learned/i }));
        expect(screen.queryByRole("button", { name: /learned/i })).toBeNull();
    });

    it("renders nothing for an already-learned piece", () => {
        writeMastery("btn-learned", markLearned(null, Date.now()));
        const { container } = render(<MarkLearnedButton id="btn-learned" />);
        expect(container.firstChild).toBeNull();
    });
});

// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LibraryFilters } from "./libraryFilters";

const noop = () => {};

const mount = (overrides: Partial<Parameters<typeof LibraryFilters>[0]> = {}) =>
    render(
        <LibraryFilters
            kind=""
            onKind={noop}
            grades={new Set<number>()}
            onToggleGrade={noop}
            onClearGrades={noop}
            favoritesOnly={false}
            onToggleFavoritesOnly={noop}
            dueOnly={false}
            onToggleDueOnly={noop}
            showDue={false}
            {...overrides}
        />,
    );

afterEach(cleanup);

describe("LibraryFilters", () => {
    it("reports the picked kind, and All clears it", () => {
        const onKind = vi.fn();
        mount({ kind: "study", onKind });
        fireEvent.click(screen.getByRole("button", { name: "Songs" }));
        expect(onKind).toHaveBeenCalledWith("song");
        fireEvent.click(screen.getAllByRole("button", { name: "All" })[0] as HTMLElement);
        expect(onKind).toHaveBeenCalledWith("");
    });

    it("toggles a grade chip and clears the set from the grade All chip", () => {
        const onToggleGrade = vi.fn();
        const onClearGrades = vi.fn();
        mount({ grades: new Set([3]), onToggleGrade, onClearGrades });
        const three = screen.getByLabelText("Grade 3");
        expect(three.getAttribute("aria-pressed")).toBe("true");
        fireEvent.click(three);
        expect(onToggleGrade).toHaveBeenCalledWith(3);
        fireEvent.click(screen.getAllByRole("button", { name: "All" })[1] as HTMLElement);
        expect(onClearGrades).toHaveBeenCalledTimes(1);
    });

    it("hides the Due chip until something is due", () => {
        mount({ showDue: false });
        expect(screen.queryByRole("button", { name: /due now/i })).toBeNull();
        cleanup();
        const onToggleDueOnly = vi.fn();
        mount({ showDue: true, onToggleDueOnly });
        fireEvent.click(screen.getByRole("button", { name: /due now/i }));
        expect(onToggleDueOnly).toHaveBeenCalledTimes(1);
    });

    it("announces the favorites toggle state", () => {
        const onToggleFavoritesOnly = vi.fn();
        mount({ favoritesOnly: true, onToggleFavoritesOnly });
        const chip = screen.getByRole("button", { name: /favorites/i });
        expect(chip.getAttribute("aria-pressed")).toBe("true");
        fireEvent.click(chip);
        expect(onToggleFavoritesOnly).toHaveBeenCalledTimes(1);
    });
});

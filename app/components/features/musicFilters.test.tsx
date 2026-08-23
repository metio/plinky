// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MusicFilters } from "./musicFilters";
import { m } from "../../paraglide/messages.js";

const noop = () => {};

const mount = (overrides: Partial<Parameters<typeof MusicFilters>[0]> = {}) =>
    render(
        <MusicFilters
            kind=""
            onKind={noop}
            grades={new Set<number>()}
            onToggleGrade={noop}
            onClearGrades={noop}
            favoritesOnly={false}
            onToggleFavoritesOnly={noop}
            dueOnly={false}
            onToggleDueOnly={noop}
            freshOnly={false}
            onToggleFreshOnly={noop}
            showDue={false}
            {...overrides}
        />,
    );

afterEach(cleanup);

describe("MusicFilters", () => {
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
        const chip = screen.getByRole("button", { name: m.scores_filter_favorites() });
        expect(chip.getAttribute("aria-pressed")).toBe("true");
        fireEvent.click(chip);
        expect(onToggleFavoritesOnly).toHaveBeenCalledTimes(1);
    });

    it("offers a filter for what has not been tried yet", () => {
        const onToggle = vi.fn();
        mount({ onToggleFreshOnly: onToggle });
        const chip = screen.getByRole("button", { name: m.music_filter_fresh() });
        expect(chip.getAttribute("aria-pressed")).toBe("false");
        fireEvent.click(chip);
        expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it("says so in one word when nothing is filtering the list", () => {
        mount();
        // The summary is the one control that expands, so that is how it is found — its
        // label is the thing under test and must not also be the selector.
        expect(screen.getByRole("button", { expanded: false }).textContent).toContain(
            m.music_filters_none(),
        );
    });

    it("reads the live filters back in the summary line", () => {
        mount({
            kind: "song",
            grades: new Set([4, 2]),
            favoritesOnly: true,
        });
        const summary = screen.getByRole("button", { expanded: false });
        expect(summary.textContent).toContain(
            `${m.music_kind_songs()} · ${m.music_filters_grades({ list: "2, 4" })} · ${m.scores_filter_favorites()}`,
        );
        // Four narrowings: the kind, each of the two grades, and the favourites toggle.
        expect(summary.textContent).toContain("4");
    });

    it("names a lone grade in the singular rather than as a list of one", () => {
        mount({ grades: new Set([6]) });
        expect(screen.getByRole("button", { expanded: false }).textContent).toContain(
            m.score_grade({ grade: 6 }),
        );
    });

    it("opens the groups when the summary is pressed", () => {
        mount();
        const summary = screen.getByRole("button", { expanded: false });
        fireEvent.click(summary);
        expect(summary.getAttribute("aria-expanded")).toBe("true");
        const panel = document.getElementById(summary.getAttribute("aria-controls") as string);
        expect(panel?.className).not.toContain("hidden");
    });
});

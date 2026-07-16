// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LibraryItem } from "../../../core/library";
import { LibraryRow } from "./libraryRow";
import { m } from "../../paraglide/messages.js";

const item = (parts: Partial<LibraryItem> = {}): LibraryItem => ({
    id: "piece-1",
    title: "Ode to Joy",
    composer: "Ludwig van Beethoven",
    grade: 2,
    removable: false,
    kind: "song",
    ...parts,
});

const mount = (ui: Parameters<typeof render>[0]) => render(<MemoryRouter>{ui}</MemoryRouter>);

const defaults = {
    starred: false,
    learned: false,
    due: false,
    onToggleStar: () => {},
};

afterEach(cleanup);

describe("LibraryRow", () => {
    it("links the title to the piece's play page", () => {
        mount(
            <ul>
                <LibraryRow item={item()} {...defaults} />
            </ul>,
        );
        const title = screen.getByText("Ode to Joy");
        expect(title.closest("a")?.getAttribute("href")).toContain("/play/piece-1");
    });

    it("links a recognised composer to their person page", () => {
        mount(
            <ul>
                <LibraryRow item={item()} {...defaults} />
            </ul>,
        );
        const composer = screen.getByText("Ludwig van Beethoven");
        expect(composer.closest("a")?.getAttribute("href")).toContain(
            "/person/ludwig-van-beethoven",
        );
    });

    it("renders a traditional credit as plain text — no person page exists for it", () => {
        mount(
            <ul>
                <LibraryRow item={item({ composer: "Traditional" })} {...defaults} />
            </ul>,
        );
        expect(screen.getByText("Traditional").closest("a")).toBeNull();
    });

    it("shows the learned and due badges only when set", () => {
        const { rerender } = mount(
            <ul>
                <LibraryRow item={item()} {...defaults} />
            </ul>,
        );
        expect(screen.queryByText("Learned")).toBeNull();
        rerender(
            <MemoryRouter>
                <ul>
                    <LibraryRow item={item()} {...defaults} learned due />
                </ul>
            </MemoryRouter>,
        );
        expect(screen.getByText("Learned")).toBeTruthy();
        expect(screen.getByText("Review due")).toBeTruthy();
    });

    it("fires the star toggle and reflects the starred state", () => {
        const onToggleStar = vi.fn();
        mount(
            <ul>
                <LibraryRow item={item()} {...defaults} onToggleStar={onToggleStar} />
            </ul>,
        );
        fireEvent.click(screen.getByLabelText(m.scores_favorite()));
        expect(onToggleStar).toHaveBeenCalledTimes(1);
    });

    it("offers no remove control without an onRemove handler", () => {
        mount(
            <ul>
                <LibraryRow item={item()} {...defaults} />
            </ul>,
        );
        expect(screen.queryByLabelText("Remove")).toBeNull();
    });

    it("removes only after the armed confirm, with the caller's label", () => {
        const onRemove = vi.fn();
        mount(
            <ul>
                <LibraryRow
                    item={item({ removable: true })}
                    {...defaults}
                    onRemove={onRemove}
                    removeConfirmLabel="Used by 1 assignment — remove?"
                />
            </ul>,
        );
        fireEvent.click(screen.getByLabelText("Remove"));
        expect(onRemove).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Used by 1 assignment — remove?" }));
        expect(onRemove).toHaveBeenCalledTimes(1);
    });
});

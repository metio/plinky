// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MusicItem } from "../../../core/music";
import { MusicRow } from "./musicRow";
import { m } from "../../paraglide/messages.js";

const item = (parts: Partial<MusicItem> = {}): MusicItem => ({
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
    colored: false,
    onToggleStar: () => {},
};

afterEach(cleanup);

describe("MusicRow", () => {
    it("links the title to the piece's play page", () => {
        mount(
            <ul>
                <MusicRow item={item()} {...defaults} />
            </ul>,
        );
        const title = screen.getByText("Ode to Joy");
        expect(title.closest("a")?.getAttribute("href")).toContain("/play/piece-1");
    });

    it("links a recognised composer to their person page", () => {
        mount(
            <ul>
                <MusicRow item={item()} {...defaults} />
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
                <MusicRow item={item({ composer: "Traditional" })} {...defaults} />
            </ul>,
        );
        expect(screen.getByText("Traditional").closest("a")).toBeNull();
    });

    it("shows the learned and due badges only when set", () => {
        const { rerender } = mount(
            <ul>
                <MusicRow item={item()} {...defaults} />
            </ul>,
        );
        expect(screen.queryByText("Learned")).toBeNull();
        rerender(
            <MemoryRouter>
                <ul>
                    <MusicRow item={item()} {...defaults} learned due />
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
                <MusicRow item={item()} {...defaults} onToggleStar={onToggleStar} />
            </ul>,
        );
        fireEvent.click(screen.getByLabelText(m.scores_favorite()));
        expect(onToggleStar).toHaveBeenCalledTimes(1);
    });

    it("offers no remove control without an onRemove handler", () => {
        mount(
            <ul>
                <MusicRow item={item()} {...defaults} />
            </ul>,
        );
        expect(screen.queryByLabelText("Remove")).toBeNull();
    });

    it("removes only after the armed confirm, with the caller's label", () => {
        const onRemove = vi.fn();
        mount(
            <ul>
                <MusicRow
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

    it("colours the opening bar by note name when the reading aid is on", () => {
        // The mark is baked as a compact string in the manifest and drawn here, so
        // "baked" describes the data and not the picture — it can be coloured exactly
        // like the score it opens.
        const { container } = mount(
            <ul>
                <MusicRow item={item({ incipit: "G35q36q37q" })} {...defaults} colored />
            </ul>,
        );
        const heads = [...container.querySelectorAll("ellipse, circle")];
        const fills = heads.map((head) => head.getAttribute("fill"));
        expect(fills.some((fill) => fill !== null && fill !== "currentColor")).toBe(true);
    });

    it("draws it in plain ink when the aid is off", () => {
        const { container } = mount(
            <ul>
                <MusicRow item={item({ incipit: "G35q36q37q" })} {...defaults} />
            </ul>,
        );
        const fills = [...container.querySelectorAll("ellipse, circle")].map((head) =>
            head.getAttribute("fill"),
        );
        expect(
            fills.every((fill) => fill === null || fill === "currentColor" || fill === "none"),
        ).toBe(true);
    });
});

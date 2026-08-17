// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { composerCounts } from "../../../core/person";
import { ComposerList } from "./composerList";

afterEach(cleanup);

const piece = (parts: { id?: string; composer: string }) => ({ id: "id", ...parts });

// A catalogue with one composer holding several pieces, one holding a single piece, and a
// credit that names a tradition rather than a person.
const CATALOGUE = [
    piece({ id: "a", composer: "Claude Debussy" }),
    piece({ id: "b", composer: "Claude Debussy" }),
    piece({ id: "c", composer: "Claude Debussy" }),
    piece({ id: "d", composer: "Amy Beach" }),
    piece({ id: "e", composer: "Traditional" }),
];

function show(query = "", people = composerCounts(CATALOGUE)) {
    render(
        <MemoryRouter>
            <ComposerList people={people} query={query} />
        </MemoryRouter>,
    );
}

describe("ComposerList", () => {
    it("lists a composer the catalogue credits only once", () => {
        // The defect this replaced: the list was built from the prerender index, which
        // deliberately holds only composers with three pieces or more. Four out of every
        // five composers were missing from the directory and from its search, under a
        // heading promising everybody the catalogue credits.
        show();
        expect(screen.getByRole("link", { name: "Amy Beach" })).toBeTruthy();
        expect(screen.getByRole("link", { name: "Claude Debussy" })).toBeTruthy();
    });

    it("finds a one-piece composer by name", () => {
        show("beach");
        expect(screen.getByRole("link", { name: "Amy Beach" })).toBeTruthy();
        expect(screen.queryByRole("link", { name: "Claude Debussy" })).toBeNull();
    });

    it("counts what there is of theirs to play", () => {
        show();
        const beach = screen.getByRole("link", { name: "Amy Beach" }).closest("li");
        expect(beach?.textContent).toContain("1");
        const debussy = screen.getByRole("link", { name: "Claude Debussy" }).closest("li");
        expect(debussy?.textContent).toContain("3");
    });

    it("reads alphabetically, not by how much of theirs there is", () => {
        // A directory is read by name; peopleFrom, which the person PAGE uses, orders by
        // how much of theirs there is.
        show();
        const names = screen.getAllByRole("link").map((link) => link.textContent);
        expect(names).toEqual(["Amy Beach", "Claude Debussy"]);
    });

    it("searches without the reader having to type the accents", () => {
        show("faure", composerCounts([piece({ id: "f", composer: "Gabriel Fauré" })]));
        expect(screen.getByRole("link", { name: "Gabriel Fauré" })).toBeTruthy();
    });

    it("leaves out a credit that names a tradition rather than a person", () => {
        show();
        expect(screen.queryByText("Traditional")).toBeNull();
    });

    it("says so when a search matches nobody", () => {
        show("nobody at all");
        expect(screen.queryAllByRole("link")).toEqual([]);
    });
});

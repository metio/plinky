// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Attribution } from "./attribution";

afterEach(cleanup);

describe("Attribution", () => {
    it("shows a public-domain piece with its source, both linked to their deeds", () => {
        render(<Attribution composer="Trad." license="CC0-1.0" source="pdmx" />);

        const license = screen.getByRole("link", { name: /public domain/i });
        expect(license.getAttribute("href")).toContain("creativecommons.org/publicdomain/zero/1.0");

        const source = screen.getByRole("link", { name: "PDMX" });
        expect(source.getAttribute("href")).toMatch(/^https:\/\//);
    });

    it("labels a permissions licence by its code without the public-domain wording", () => {
        render(<Attribution license="CC-BY-SA-4.0" />);
        expect(screen.getByRole("link", { name: "CC BY-SA 4.0" })).toBeTruthy();
        expect(screen.queryByText(/public domain/i)).toBeNull();
    });

    it("credits the editor for a source whose licence requires attribution", () => {
        render(<Attribution composer="Anon." license="CC-BY-SA-4.0" source="cpdl" />);
        expect(screen.getByRole("link", { name: "CC BY-SA 4.0" })).toBeTruthy();
        expect(screen.getByRole("link", { name: "CPDL" })).toBeTruthy();
        expect(screen.getByText(/the CPDL editors/)).toBeTruthy();
    });

    it("renders nothing for a piece with no licence or source", () => {
        const { container } = render(<Attribution composer="Anon." />);
        expect(container.firstChild).toBeNull();
    });

    it("names the engraver when the edition names one", () => {
        // CC-BY and CC-BY-SA ask for the creator to be credited. "the CPDL editors" is
        // what to say when nobody is named; saying it when somebody IS named credits the
        // wrong thing, and it is the licence's whole requirement.
        render(
            <Attribution
                composer="Josquin des Prez"
                license="CC-BY-SA-4.0"
                source="cpdl"
                credit="Sabine Cassola"
            />,
        );

        expect(screen.getByText(/Sabine Cassola/)).toBeTruthy();
        expect(screen.queryByText(/the CPDL editors/)).toBeNull();
    });

    it("falls back to the project when the edition names nobody", () => {
        render(<Attribution composer="Anon." license="CC-BY-SA-4.0" source="cpdl" />);

        expect(screen.getByText(/the CPDL editors/)).toBeTruthy();
    });
});

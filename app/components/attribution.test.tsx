// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
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

    it("credits the engraver for a source whose licence requires attribution", () => {
        render(<Attribution composer="Scott Joplin" license="CC-BY-NC-SA-4.0" source="kern" />);
        expect(screen.getByRole("link", { name: "CC BY-NC-SA 4.0" })).toBeTruthy();
        expect(screen.getByRole("link", { name: "KernScores" })).toBeTruthy();
        expect(screen.getByText(/Craig Stuart Sapp/)).toBeTruthy();
    });

    it("renders nothing for a piece with no licence or source", () => {
        const { container } = render(<Attribution composer="Anon." />);
        expect(container.firstChild).toBeNull();
    });
});

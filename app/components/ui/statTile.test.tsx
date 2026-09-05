// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StatTile } from "./statTile";

vi.mock("../../paraglide/runtime.js", () => ({ getLocale: () => "de" }));

afterEach(cleanup);

describe("StatTile", () => {
    it("writes a number the way the reader's language does, under its caption", () => {
        render(<StatTile label="Notes played" value={12345} />);
        expect(screen.getByText("12.345")).toBeTruthy();
        expect(screen.getByText("Notes played")).toBeTruthy();
    });

    it("shows a figure already spelled out as it is", () => {
        render(<StatTile label="Total time" value="1 h 20 min" />);
        expect(screen.getByText("1 h 20 min")).toBeTruthy();
    });

    it("stands on its own card unless told to sit on the surface around it", () => {
        const { container: framed } = render(<StatTile label="a" value={1} />);
        expect(framed.firstElementChild?.className).toContain("border");
        cleanup();
        const { container: bare } = render(<StatTile label="a" value={1} framed={false} />);
        expect(bare.firstElementChild?.className).not.toContain("border");
    });
});

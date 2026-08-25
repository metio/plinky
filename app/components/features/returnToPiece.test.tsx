// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { m } from "../../paraglide/messages.js";
import { ReturnToPiece } from "./returnToPiece";

afterEach(cleanup);

const at = (search: string) =>
    render(
        <MemoryRouter initialEntries={[`/play/exercise${search}`]}>
            <ReturnToPiece />
        </MemoryRouter>,
    );

describe("the way back from a warm-up", () => {
    it("names the piece it returns to, and points at it", () => {
        at("?then=abc123&fromTitle=Gymnop%C3%A9die%20No.%201");
        const link = screen.getByRole("link", {
            name: new RegExp(m.warmup_back({ title: "Gymnopédie No. 1" })),
        });
        expect(link.getAttribute("href")).toContain("/play/abc123");
    });

    it("says nothing when nothing sent the player here", () => {
        // The exercise is a piece in its own right, reachable from the library like any
        // other. A back link then points at somewhere the player has never been.
        at("");
        expect(screen.queryByRole("link")).toBeNull();
    });

    it("says nothing on half a link, rather than something it cannot finish", () => {
        // A title with no id has nowhere to go; an id with no title cannot say where.
        at("?then=abc123");
        expect(screen.queryByRole("link")).toBeNull();
        cleanup();
        at("?fromTitle=Something");
        expect(screen.queryByRole("link")).toBeNull();
    });
});

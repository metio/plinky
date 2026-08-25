// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { m } from "../../paraglide/messages.js";
import { WarmUpWays } from "./warmUpWays";

afterEach(cleanup);

const at = (node: React.ReactNode) => render(<MemoryRouter>{node}</MemoryRouter>);

describe("WarmUpWays", () => {
    it("offers the three that need nothing decided, with or without the day's challenge", () => {
        at(<WarmUpWays arcadeTo="/play/x" arcadeKey="F♯" />);
        for (const label of [m.arcade_title(), m.today_drill(), m.ear_title()]) {
            expect(screen.getByRole("link", { name: new RegExp(label) })).toBeTruthy();
        }
        // No hole where the lead will be: the day's tasks arrive a moment later than the
        // page does, and a block that reserved a gap for them would flash one.
        expect(screen.getAllByRole("link").length).toBe(3);
    });

    it("says which key the ladder is about to ask for", () => {
        // The rung it used to show was a number of nothing — the ladder has no end. The key
        // is what a sight-reader wants to know before pressing it.
        at(<WarmUpWays arcadeTo="/play/x" arcadeKey="F♯" />);
        expect(
            screen.getByRole("link", { name: new RegExp(m.arcade_title()) }).textContent,
        ).toContain("F♯");
    });

    it("leads with the day's challenge until it is done", () => {
        const { container } = at(
            <WarmUpWays
                daily={{ to: "/daily", label: "Today's challenge", done: false }}
                arcadeTo="/play/x"
                arcadeKey="C"
            />,
        );
        const lead = screen.getByRole("link", { name: /Today's challenge/ });
        expect(lead.className).toContain("bg-spark-surface");
        cleanup();

        at(
            <WarmUpWays
                daily={{ to: "/daily", label: "Today's challenge", done: true }}
                arcadeTo="/play/x"
                arcadeKey="C"
            />,
        );
        // Done, it keeps its place and loses only its weight: a block that rearranged
        // itself the moment you finished something would move under your hands.
        const settled = screen.getByRole("link", { name: /Today's challenge/ });
        expect(settled.className).not.toContain("bg-spark-surface");
        expect(container).toBeTruthy();
    });
});

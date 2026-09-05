// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_KEY_MAP, rebind } from "../../../core/keyMap";
import { KeyboardHint } from "./keyboardHint";

afterEach(cleanup);

function renderHint(octaveOffset: number) {
    return render(
        <MemoryRouter>
            <KeyboardHint octaveOffset={octaveOffset} />
        </MemoryRouter>,
    );
}

describe("KeyboardHint", () => {
    it("shows a positive octave offset with a leading sign", () => {
        renderHint(2);
        expect(screen.getByText("+2")).toBeTruthy();
    });

    it("shows a zero offset without a sign", () => {
        renderHint(0);
        expect(screen.getByText("0")).toBeTruthy();
    });

    it("shows a negative offset", () => {
        renderHint(-1);
        expect(screen.getByText("-1")).toBeTruthy();
    });

    it("names the keys the player's own map plays, not the stock ones", () => {
        // A left-hand C rebound from Z to A: the hint has to say A, or the two panels on
        // the settings page disagree about which key plays which note.
        render(
            <MemoryRouter>
                <KeyboardHint octaveOffset={0} keyMap={rebind(DEFAULT_KEY_MAP, "left", 0, "a")} />
            </MemoryRouter>,
        );
        expect(screen.getByText("A X C V B N M")).toBeTruthy();
        expect(screen.queryByText("Z X C V B N M")).toBeNull();
    });

    it("names the stock keys by default", () => {
        renderHint(0);
        expect(screen.getByText("Z X C V B N M")).toBeTruthy();
        expect(screen.getByText("Q W E R T Y U")).toBeTruthy();
    });
});

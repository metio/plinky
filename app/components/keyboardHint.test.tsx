// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
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
});

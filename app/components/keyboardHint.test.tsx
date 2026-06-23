// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { KeyboardHint } from "./keyboardHint";

afterEach(cleanup);

describe("KeyboardHint", () => {
    it("shows a positive octave offset with a leading sign", () => {
        render(<KeyboardHint octaveOffset={2} />);
        expect(screen.getByText("+2")).toBeTruthy();
    });

    it("shows a zero offset without a sign", () => {
        render(<KeyboardHint octaveOffset={0} />);
        expect(screen.getByText("0")).toBeTruthy();
    });

    it("shows a negative offset", () => {
        render(<KeyboardHint octaveOffset={-1} />);
        expect(screen.getByText("-1")).toBeTruthy();
    });
});

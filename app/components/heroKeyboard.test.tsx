// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HeroKeyboard } from "./heroKeyboard";

afterEach(cleanup);

describe("HeroKeyboard", () => {
    it("renders one octave of labelled keys", () => {
        render(<HeroKeyboard />);
        // C4–C5: 8 white + 5 black keys, each a labelled button.
        expect(screen.getAllByRole("button")).toHaveLength(13);
        expect(screen.getByLabelText("C4")).toBeTruthy();
        expect(screen.getByLabelText("C5")).toBeTruthy();
    });

    it("lights a key when it is pressed", () => {
        // No AudioContext under jsdom, so the synth no-ops — the press still lights up.
        render(<HeroKeyboard />);
        const key = screen.getByLabelText("C4");
        fireEvent.pointerDown(key);
        expect(key.className).toContain("bg-green-100");
    });
});
